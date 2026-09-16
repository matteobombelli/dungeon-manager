import { CampaignCreate, CampaignUpdate, SceneCreate, type SceneLink } from "../../shared/api";
import { CampaignGraphSchema } from "../../shared/campaign-graph";
import { newId } from "../../shared/ids";
import { requireUser } from "../auth/session";
import { getCampaignOwned, toCampaign, toScene, type CampaignRow, type SceneRow } from "../db";
import { json, now, parseJson } from "../http";
import { HttpError, type Router } from "../router";

// A D1 statement takes at most 100 bind parameters.
const LINKS_PER_INSERT = 20; // 5 columns

export function registerCampaignRoutes(r: Router): void {
  r.get("/campaigns", async (c) => {
    const user = await requireUser(c);
    const { results } = await c.env.DB.prepare(
      "SELECT id, user_id, name, description, created_at, updated_at FROM campaigns WHERE user_id = ? ORDER BY created_at DESC",
    )
      .bind(user.id)
      .all<CampaignRow>();
    return json({ campaigns: results.map(toCampaign) });
  });

  r.post("/campaigns", async (c) => {
    const user = await requireUser(c);
    const body = await parseJson(c.req, CampaignCreate);
    const t = now();
    const row: CampaignRow = {
      id: newId(),
      user_id: user.id,
      name: body.name,
      description: body.description,
      created_at: t,
      updated_at: t,
    };
    await c.env.DB.prepare(
      "INSERT INTO campaigns (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(row.id, row.user_id, row.name, row.description, row.created_at, row.updated_at)
      .run();
    return json({ campaign: toCampaign(row) }, 201);
  });

  r.get("/campaigns/:id", async (c) => {
    const user = await requireUser(c);
    const campaign = await getCampaignOwned(c.env.DB, c.params.id, user.id);
    const [scenes, links] = await Promise.all([
      c.env.DB.prepare(
        "SELECT id, campaign_id, user_id, name, x, y, color, created_at, updated_at FROM scenes WHERE campaign_id = ? ORDER BY created_at DESC",
      )
        .bind(campaign.id)
        .all<SceneRow>(),
      c.env.DB.prepare("SELECT id, source, target, label FROM scene_links WHERE campaign_id = ?")
        .bind(campaign.id)
        .all<SceneLink>(),
    ]);
    return json({ campaign: toCampaign(campaign), scenes: scenes.results.map(toScene), links: links.results });
  });

  r.patch("/campaigns/:id", async (c) => {
    const user = await requireUser(c);
    const row = await getCampaignOwned(c.env.DB, c.params.id, user.id);
    const body = await parseJson(c.req, CampaignUpdate);
    const next: CampaignRow = {
      ...row,
      name: body.name ?? row.name,
      description: body.description ?? row.description,
      updated_at: now(),
    };
    await c.env.DB.prepare("UPDATE campaigns SET name = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(next.name, next.description, next.updated_at, next.id, user.id)
      .run();
    return json({ campaign: toCampaign(next) });
  });

  r.delete("/campaigns/:id", async (c) => {
    const user = await requireUser(c);
    const campaign = await getCampaignOwned(c.env.DB, c.params.id, user.id);
    // Scenes, nodes and edges go with it through ON DELETE CASCADE.
    await c.env.DB.prepare("DELETE FROM campaigns WHERE id = ? AND user_id = ?").bind(campaign.id, user.id).run();
    return new Response(null, { status: 204 });
  });

  r.post("/campaigns/:id/scenes", async (c) => {
    const user = await requireUser(c);
    const campaign = await getCampaignOwned(c.env.DB, c.params.id, user.id);
    const body = await parseJson(c.req, SceneCreate);
    const t = now();
    const row: SceneRow = {
      id: newId(),
      campaign_id: campaign.id,
      user_id: campaign.user_id,
      name: body.name,
      x: body.x ?? 0,
      y: body.y ?? 0,
      color: null,
      created_at: t,
      updated_at: t,
    };
    await c.env.DB.prepare(
      "INSERT INTO scenes (id, campaign_id, user_id, name, x, y, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(row.id, row.campaign_id, row.user_id, row.name, row.x, row.y, row.created_at, row.updated_at)
      .run();
    return json({ scene: toScene(row) }, 201);
  });

  r.put("/campaigns/:id/graph", async (c) => {
    const user = await requireUser(c);
    const campaign = await getCampaignOwned(c.env.DB, c.params.id, user.id);
    const graph = await parseJson(c.req, CampaignGraphSchema);
    const db = c.env.DB;

    // Link endpoints are already constrained to graph.scenes, so checking the scenes covers both.
    const { results } = await db
      .prepare("SELECT id FROM scenes WHERE campaign_id = ?")
      .bind(campaign.id)
      .all<{ id: string }>();
    const owned = new Set(results.map((row) => row.id));
    for (const scene of graph.scenes) {
      if (!owned.has(scene.id)) throw new HttpError(400, "Unknown scene", { id: scene.id });
    }

    // Scenes left out of the body keep their stored position; their scene_links rows do not survive.
    const updatedAt = now();
    const statements = graph.scenes.map((scene) =>
      db
        .prepare("UPDATE scenes SET x = ?, y = ?, color = ? WHERE id = ? AND campaign_id = ?")
        .bind(scene.x, scene.y, scene.color, scene.id, campaign.id),
    );
    statements.push(db.prepare("DELETE FROM scene_links WHERE campaign_id = ?").bind(campaign.id));
    for (let i = 0; i < graph.links.length; i += LINKS_PER_INSERT) {
      const slice = graph.links.slice(i, i + LINKS_PER_INSERT);
      statements.push(
        db
          .prepare(
            `INSERT INTO scene_links (campaign_id, id, source, target, label) VALUES ${slice
              .map(() => "(?, ?, ?, ?, ?)")
              .join(", ")}`,
          )
          .bind(...slice.flatMap((l) => [campaign.id, l.id, l.source, l.target, l.label])),
      );
    }
    statements.push(db.prepare("UPDATE campaigns SET updated_at = ? WHERE id = ?").bind(updatedAt, campaign.id));

    await db.batch(statements);
    return json({ updatedAt });
  });
}
