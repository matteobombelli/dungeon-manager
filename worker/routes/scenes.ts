import { SceneUpdate } from "../../shared/api";
import { GraphSchema, type Graph } from "../../shared/graph";
import type { NodeTypeId } from "../../shared/nodes/registry";
import { requireUser } from "../auth/session";
import { getSceneOwned, toScene } from "../db";
import { json, now, parseJson } from "../http";
import type { Router } from "../router";

const GRAPH_MAX_BYTES = 8 * 1024 * 1024;

// A D1 statement takes at most 100 bind parameters.
const NODES_PER_INSERT = 12; // 8 columns

interface NodeRow {
  id: string;
  type: NodeTypeId;
  x: number;
  y: number;
  color: string | null;
  data: string;
}

export function registerSceneRoutes(r: Router): void {
  r.get("/scenes/:id", async (c) => {
    const user = await requireUser(c);
    const scene = await getSceneOwned(c.env.DB, c.params.id, user.id);
    const nodes = await c.env.DB.prepare("SELECT id, type, x, y, color, data FROM nodes WHERE scene_id = ? ORDER BY sort")
      .bind(scene.id)
      .all<NodeRow>();
    const graph: Graph = {
      nodes: nodes.results.map((n) => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        color: n.color,
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

    const statements = [db.prepare("DELETE FROM nodes WHERE scene_id = ?").bind(scene.id)];
    for (let i = 0; i < graph.nodes.length; i += NODES_PER_INSERT) {
      const slice = graph.nodes.slice(i, i + NODES_PER_INSERT);
      statements.push(
        db
          .prepare(
            `INSERT INTO nodes (scene_id, id, type, x, y, color, data, sort) VALUES ${slice
              .map(() => "(?, ?, ?, ?, ?, ?, ?, ?)")
              .join(", ")}`,
          )
          .bind(...slice.flatMap((n, j) => [scene.id, n.id, n.type, n.x, n.y, n.color, JSON.stringify(n.data), i + j])),
      );
    }
    statements.push(db.prepare("UPDATE scenes SET updated_at = ? WHERE id = ?").bind(updatedAt, scene.id));

    await db.batch(statements);
    return json({ updatedAt });
  });
}
