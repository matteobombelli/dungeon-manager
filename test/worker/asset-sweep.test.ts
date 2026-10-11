import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Campaign, Scene } from "../../shared/api";
import { NODE_TYPES } from "../../shared/nodes/registry";
import { ASSET_GRACE_MS, sweepAssets } from "../../worker/asset-sweep";
import { cookieHeader, jsonRequest, registerAndLogin, request } from "./helpers";

// D1 and R2 state persists across tests within a file, so every registration needs its own email.
let seq = 0;
async function user(): Promise<string> {
  return (await registerAndLogin(`sweep${++seq}@example.com`)).cookie;
}

const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (ch) => ch.charCodeAt(0),
);

async function uploadPng(cookie: string): Promise<string> {
  const res = await request("/assets", { method: "POST", headers: { "Content-Type": "image/png", Cookie: cookie }, body: PNG });
  expect(res.status).toBe(201);
  return ((await res.json()) as { asset: { id: string } }).asset.id;
}

async function campaignWithScene(cookie: string): Promise<{ campaign: Campaign; scene: Scene }> {
  const campaign = ((await (await jsonRequest("/campaigns", "POST", { name: "C" }, cookie)).json()) as { campaign: Campaign })
    .campaign;
  const scene = ((await (await jsonRequest(`/campaigns/${campaign.id}/scenes`, "POST", { name: "S" }, cookie)).json()) as {
    scene: Scene;
  }).scene;
  return { campaign, scene };
}

function character(id: string, portraitAssetId: string | null) {
  return { id, type: "character", x: 0, y: 0, data: { ...NODE_TYPES.character.defaultData(), portraitAssetId } };
}

async function putNodes(cookie: string, sceneId: string, nodes: unknown[]): Promise<void> {
  const res = await jsonRequest(`/scenes/${sceneId}/graph`, "PUT", { nodes }, cookie);
  expect(res.status, await res.clone().text()).toBe(200);
}

async function refsOf(sceneId: string): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT asset_id FROM asset_refs WHERE scene_id = ? ORDER BY asset_id")
    .bind(sceneId)
    .all<{ asset_id: string }>();
  return results.map((r) => r.asset_id);
}

async function exists(cookie: string, assetId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT r2_key FROM assets WHERE id = ?").bind(assetId).first<{ r2_key: string }>();
  const res = await request(`/assets/${assetId}`, { headers: cookieHeader(cookie) });
  await res.body?.cancel();
  if (!row) {
    expect(res.status).toBe(404);
    return false;
  }
  expect(await env.BUCKET.head(row.r2_key)).not.toBeNull();
  return true;
}

/** Runs the sweep at `t`, then once the grace period has passed since `t`. */
async function sweepThroughGrace(t: number): Promise<void> {
  await sweepAssets(env, t);
  await sweepAssets(env, t + ASSET_GRACE_MS);
}

describe("asset references", () => {
  it("records the assets a scene's nodes and group children reference, and only the user's own", async () => {
    const alice = await user();
    const bob = await user();
    const { scene } = await campaignWithScene(alice);
    const top = await uploadPng(alice);
    const inGroup = await uploadPng(alice);
    const bobs = await uploadPng(bob);
    const group = { id: "g", type: "group", x: 0, y: 0, data: { name: "", nodes: [character("c2", inGroup)] } };
    await putNodes(alice, scene.id, [character("c1", top), character("c3", bobs), group]);
    expect(await refsOf(scene.id)).toEqual([top, inGroup].sort());

    // A save without the asset drops its row.
    await putNodes(alice, scene.id, [character("c1", null), group]);
    expect(await refsOf(scene.id)).toEqual([inGroup]);
  });

  it("goes with the scene when it is deleted", async () => {
    const alice = await user();
    const { scene } = await campaignWithScene(alice);
    const id = await uploadPng(alice);
    await putNodes(alice, scene.id, [character("c", id)]);
    expect((await request(`/scenes/${scene.id}`, { method: "DELETE", headers: cookieHeader(alice) })).status).toBe(204);
    expect(await refsOf(scene.id)).toEqual([]);
  });
});

describe("sweepAssets", () => {
  it("keeps a referenced asset however much time passes", async () => {
    const alice = await user();
    const { scene } = await campaignWithScene(alice);
    const id = await uploadPng(alice);
    await putNodes(alice, scene.id, [character("c", id)]);
    await sweepThroughGrace(Date.now());
    expect(await exists(alice, id)).toBe(true);
  });

  it("deletes an unreferenced asset, row and object, only once the grace period has passed", async () => {
    const alice = await user();
    const id = await uploadPng(alice);
    const key = (await env.DB.prepare("SELECT r2_key FROM assets WHERE id = ?").bind(id).first<{ r2_key: string }>())!.r2_key;
    const t = Date.now();
    await sweepAssets(env, t);
    await sweepAssets(env, t + ASSET_GRACE_MS - 1);
    expect(await exists(alice, id)).toBe(true);
    const { deleted } = await sweepAssets(env, t + ASSET_GRACE_MS);
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await exists(alice, id)).toBe(false);
    expect(await env.BUCKET.head(key)).toBeNull();
  });

  it("restarts the grace period when an asset is referenced again (undo, paste)", async () => {
    const alice = await user();
    const { scene } = await campaignWithScene(alice);
    const id = await uploadPng(alice);
    const t = Date.now();
    await sweepAssets(env, t); // unreferenced since upload: marked
    await putNodes(alice, scene.id, [character("c", id)]);
    await sweepAssets(env, t + ASSET_GRACE_MS / 2); // referenced: mark cleared
    await putNodes(alice, scene.id, []);
    await sweepAssets(env, t + ASSET_GRACE_MS); // unreferenced again: marked anew
    await sweepAssets(env, t + ASSET_GRACE_MS + ASSET_GRACE_MS / 2);
    expect(await exists(alice, id)).toBe(true);
    await sweepAssets(env, t + 2 * ASSET_GRACE_MS);
    expect(await exists(alice, id)).toBe(false);
  });

  it("never deletes an asset a save references between the mark and the deletion", async () => {
    const alice = await user();
    const { scene } = await campaignWithScene(alice);
    const id = await uploadPng(alice);
    const t = Date.now();
    await sweepAssets(env, t);
    await putNodes(alice, scene.id, [character("c", id)]); // still carries the old mark
    await sweepAssets(env, t + ASSET_GRACE_MS);
    expect(await exists(alice, id)).toBe(true);
  });

  it("keeps a trashed campaign's assets, and frees them once it is deleted for good", async () => {
    const alice = await user();
    const { campaign, scene } = await campaignWithScene(alice);
    const id = await uploadPng(alice);
    await putNodes(alice, scene.id, [character("c", id)]);
    expect((await request(`/campaigns/${campaign.id}`, { method: "DELETE", headers: cookieHeader(alice) })).status).toBe(204);
    const t = Date.now();
    await sweepThroughGrace(t);
    expect(await exists(alice, id)).toBe(true);

    const purge = await request(`/campaigns/${campaign.id}/permanent`, { method: "DELETE", headers: cookieHeader(alice) });
    expect(purge.status).toBe(204);
    await sweepThroughGrace(t + ASSET_GRACE_MS + 1);
    expect(await exists(alice, id)).toBe(false);
  });
});
