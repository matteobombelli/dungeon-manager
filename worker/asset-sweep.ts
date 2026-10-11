/** How long an asset stays unreferenced before it is deleted: long enough for undo and paste. */
export const ASSET_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

// Deleted per round; R2 deletes at most 1000 keys per call.
const SWEEP_BATCH = 500;
const MAX_ROUNDS = 20;

const UNREFERENCED = "id NOT IN (SELECT asset_id FROM asset_refs)";

/**
 * The daily garbage collection of uploaded files. Undo history and the clipboard live in the page,
 * so an image taken off a node can come back; an asset is only deleted once it has gone
 * `ASSET_GRACE_MS` without any scene referencing it. Scenes of a trashed campaign still count.
 */
export async function sweepAssets(env: Env, now: number): Promise<{ deleted: number }> {
  const db = env.DB;
  await db.batch([
    db.prepare(`UPDATE assets SET orphaned_at = NULL WHERE orphaned_at IS NOT NULL AND NOT (${UNREFERENCED})`),
    db.prepare(`UPDATE assets SET orphaned_at = ? WHERE orphaned_at IS NULL AND ${UNREFERENCED}`).bind(now),
  ]);

  let deleted = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // The row goes first, in one statement that re-checks the references, so a save that has just
    // put an asset back can never lose it. If the R2 delete then fails the object is left behind,
    // which only costs storage.
    const { results } = await db
      .prepare(
        `DELETE FROM assets WHERE id IN (
           SELECT id FROM assets WHERE orphaned_at IS NOT NULL AND orphaned_at <= ? AND ${UNREFERENCED} LIMIT ?
         ) RETURNING r2_key`,
      )
      .bind(now - ASSET_GRACE_MS, SWEEP_BATCH)
      .all<{ r2_key: string }>();
    if (results.length === 0) break;
    await env.BUCKET.delete(results.map((r) => r.r2_key));
    deleted += results.length;
  }
  return { deleted };
}
