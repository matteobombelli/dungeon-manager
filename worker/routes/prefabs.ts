import { PrefabCreate, PrefabUpdate } from "../../shared/api";
import { newId } from "../../shared/ids";
import { requireUser } from "../auth/session";
import { getPrefabOwned, toPrefab, type PrefabRow } from "../db";
import { json, now, parseJson } from "../http";
import type { Router } from "../router";

export function registerPrefabRoutes(r: Router): void {
  r.get("/prefabs", async (c) => {
    const user = await requireUser(c);
    const { results } = await c.env.DB.prepare(
      "SELECT id, user_id, name, fields, created_at, updated_at FROM prefabs WHERE user_id = ? ORDER BY created_at DESC",
    )
      .bind(user.id)
      .all<PrefabRow>();
    return json({ prefabs: results.map(toPrefab) });
  });

  r.post("/prefabs", async (c) => {
    const user = await requireUser(c);
    const body = await parseJson(c.req, PrefabCreate);
    const t = now();
    const row: PrefabRow = {
      id: newId(),
      user_id: user.id,
      name: body.name,
      fields: JSON.stringify(body.fields),
      created_at: t,
      updated_at: t,
    };
    await c.env.DB.prepare(
      "INSERT INTO prefabs (id, user_id, name, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(row.id, row.user_id, row.name, row.fields, row.created_at, row.updated_at)
      .run();
    return json({ prefab: toPrefab(row) }, 201);
  });

  r.patch("/prefabs/:id", async (c) => {
    const user = await requireUser(c);
    const row = await getPrefabOwned(c.env.DB, c.params.id, user.id);
    const body = await parseJson(c.req, PrefabUpdate);
    const next: PrefabRow = {
      ...row,
      name: body.name ?? row.name,
      fields: body.fields === undefined ? row.fields : JSON.stringify(body.fields),
      updated_at: now(),
    };
    await c.env.DB.prepare("UPDATE prefabs SET name = ?, fields = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(next.name, next.fields, next.updated_at, next.id, user.id)
      .run();
    return json({ prefab: toPrefab(next) });
  });

  r.delete("/prefabs/:id", async (c) => {
    const user = await requireUser(c);
    const prefab = await getPrefabOwned(c.env.DB, c.params.id, user.id);
    await c.env.DB.prepare("DELETE FROM prefabs WHERE id = ? AND user_id = ?").bind(prefab.id, user.id).run();
    return new Response(null, { status: 204 });
  });
}
