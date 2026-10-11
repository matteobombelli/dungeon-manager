import { SceneUpdate } from "../../shared/api";
import { assetIdsIn } from "../../shared/assets";
import { GraphSchema, type Graph } from "../../shared/graph";
import type { NodeTypeId } from "../../shared/nodes/registry";
import { requireUser } from "../auth/session";
import { getSceneOwned, toScene } from "../db";
import { json, now, parseJson } from "../http";
import { HttpError, type Router } from "../router";

const GRAPH_MAX_BYTES = 8 * 1024 * 1024;
// D1 rejects a row over 2 MB with a bare error; a node that big is refused up front instead.
const NODE_MAX_BYTES = 1.9 * 1024 * 1024;

// A D1 statement takes at most 100 bind parameters.
const NODES_PER_INSERT = 14; // 7 columns
const ASSET_IDS_PER_INSERT = 90; // plus scene id and user id

interface NodeRow {
  id: string;
  type: NodeTypeId;
  x: number;
  y: number;
  data: string;
}

export function registerSceneRoutes(r: Router): void {
  r.get("/scenes/:id", async (c) => {
    const user = await requireUser(c);
    const scene = await getSceneOwned(c.env.DB, c.params.id, user.id);
    const nodes = await c.env.DB.prepare("SELECT id, type, x, y, data FROM nodes WHERE scene_id = ? ORDER BY sort")
      .bind(scene.id)
      .all<NodeRow>();
    const graph: Graph = {
      nodes: nodes.results.map((n) => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        data: JSON.parse(n.data) as unknown,
      })),
    };
    return json({ scene: toScene(scene), graph });
  });

  r.patch("/scenes/:id", async (c) => {
    const user = await requireUser(c);
    const row = await getSceneOwned(c.env.DB, c.params.id, user.id);
    const body = await parseJson(c.req, SceneUpdate);
    const next = { ...row, name: body.name, updated_at: now() };
    await c.env.DB.prepare("UPDATE scenes SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(next.name, next.updated_at, next.id, user.id)
      .run();
    return json({ scene: toScene(next) });
  });

  r.delete("/scenes/:id", async (c) => {
    const user = await requireUser(c);
    const scene = await getSceneOwned(c.env.DB, c.params.id, user.id);
    await c.env.DB.prepare("DELETE FROM scenes WHERE id = ? AND user_id = ?").bind(scene.id, user.id).run();
    return new Response(null, { status: 204 });
  });

  r.put("/scenes/:id/graph", async (c) => {
    const user = await requireUser(c);
    const scene = await getSceneOwned(c.env.DB, c.params.id, user.id);
    const graph = await parseJson(c.req, GraphSchema, GRAPH_MAX_BYTES);
    const db = c.env.DB;
    const updatedAt = now();

    const encoder = new TextEncoder();
    const rows = graph.nodes.map((n) => {
      const data = JSON.stringify(n.data);
      if (encoder.encode(data).byteLength > NODE_MAX_BYTES) throw new HttpError(413, "Node too large", { id: n.id });
      return { ...n, data };
    });

    const statements = [db.prepare("DELETE FROM nodes WHERE scene_id = ?").bind(scene.id)];
    for (let i = 0; i < rows.length; i += NODES_PER_INSERT) {
      const slice = rows.slice(i, i + NODES_PER_INSERT);
      statements.push(
        db
          .prepare(
            `INSERT INTO nodes (scene_id, id, type, x, y, data, sort) VALUES ${slice
              .map(() => "(?, ?, ?, ?, ?, ?, ?)")
              .join(", ")}`,
          )
          .bind(...slice.flatMap((n, j) => [scene.id, n.id, n.type, n.x, n.y, n.data, i + j])),
      );
    }
    // The scene's asset references are rewritten with it; only ids that are this user's assets count.
    const assetIds = [...assetIdsIn(graph.nodes.map((n) => n.data))];
    statements.push(db.prepare("DELETE FROM asset_refs WHERE scene_id = ?").bind(scene.id));
    for (let i = 0; i < assetIds.length; i += ASSET_IDS_PER_INSERT) {
      const slice = assetIds.slice(i, i + ASSET_IDS_PER_INSERT);
      statements.push(
        db
          .prepare(
            `INSERT INTO asset_refs (scene_id, asset_id) SELECT ?, id FROM assets WHERE user_id = ? AND id IN (${slice
              .map(() => "?")
              .join(", ")})`,
          )
          .bind(scene.id, user.id, ...slice),
      );
    }
    statements.push(db.prepare("UPDATE scenes SET updated_at = ? WHERE id = ?").bind(updatedAt, scene.id));

    await db.batch(statements);
    return json({ updatedAt });
  });
}
