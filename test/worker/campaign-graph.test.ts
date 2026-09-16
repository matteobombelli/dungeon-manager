import { beforeAll, describe, expect, it } from "vitest";
import type { Campaign, Scene, SceneLink } from "../../shared/api";
import type { CampaignGraph } from "../../shared/campaign-graph";
import { cookieHeader, jsonRequest, registerAndLogin, request } from "./helpers";

// D1 state persists across tests within a file, so every registration needs its own email.
let alice = "";
let bob = "";

beforeAll(async () => {
  alice = (await registerAndLogin("alice@campaign-graph.test")).cookie;
  bob = (await registerAndLogin("bob@campaign-graph.test")).cookie;
});

async function createCampaign(cookie = alice, name = "Graph"): Promise<Campaign> {
  const res = await jsonRequest("/campaigns", "POST", { name }, cookie);
  expect(res.status).toBe(201);
  return ((await res.json()) as { campaign: Campaign }).campaign;
}

async function createScene(campaignId: string, name: string, cookie = alice): Promise<Scene> {
  const res = await jsonRequest(`/campaigns/${campaignId}/scenes`, "POST", { name }, cookie);
  expect(res.status).toBe(201);
  return ((await res.json()) as { scene: Scene }).scene;
}

function putGraph(campaignId: string, graph: unknown, cookie = alice): Promise<Response> {
  return jsonRequest(`/campaigns/${campaignId}/graph`, "PUT", graph, cookie);
}

async function getCampaign(
  campaignId: string,
  cookie = alice,
): Promise<{ campaign: Campaign; scenes: Scene[]; links: SceneLink[] }> {
  const res = await request(`/campaigns/${campaignId}`, { headers: cookieHeader(cookie) });
  expect(res.status).toBe(200);
  return (await res.json()) as { campaign: Campaign; scenes: Scene[]; links: SceneLink[] };
}

/** A campaign with three scenes named A, B and C. */
async function withScenes(name: string): Promise<{ campaign: Campaign; a: Scene; b: Scene; c: Scene }> {
  const campaign = await createCampaign(alice, name);
  return {
    campaign,
    a: await createScene(campaign.id, "A"),
    b: await createScene(campaign.id, "B"),
    c: await createScene(campaign.id, "C"),
  };
}

describe("PUT /campaigns/:id/graph", () => {
  it("round-trips scene positions and links", async () => {
    const { campaign, a, b, c } = await withScenes("Round trip");
    const graph: CampaignGraph = {
      scenes: [
        { id: a.id, x: 12.5, y: -40, color: "#cfe3f7" },
        { id: b.id, x: 300, y: 80.25, color: null },
        { id: c.id, x: 0, y: 0, color: null },
      ],
      // Links are directed, so the two between A and B are both kept.
      links: [
        { id: "l1", source: a.id, target: b.id, label: "leads to" },
        { id: "l2", source: b.id, target: a.id, label: "back to" },
        { id: "l3", source: b.id, target: c.id, label: "" },
      ],
    };

    const res = await putGraph(campaign.id, graph);
    expect(res.status).toBe(200);
    const { updatedAt } = (await res.json()) as { updatedAt: number };
    expect(typeof updatedAt).toBe("number");

    const after = await getCampaign(campaign.id);
    expect(after.campaign.updatedAt).toBe(updatedAt);
    expect(after.links).toEqual(expect.arrayContaining(graph.links));
    expect(after.links).toHaveLength(3);
    const positions = Object.fromEntries(after.scenes.map((s) => [s.id, { x: s.x, y: s.y, color: s.color }]));
    expect(positions[a.id]).toEqual({ x: 12.5, y: -40, color: "#cfe3f7" });
    expect(positions[b.id]).toEqual({ x: 300, y: 80.25, color: null });
    expect(positions[c.id]).toEqual({ x: 0, y: 0, color: null });
  });

  it("does not bump the scene timestamps", async () => {
    const { campaign, a } = await withScenes("Untouched scenes");
    expect((await putGraph(campaign.id, { scenes: [{ id: a.id, x: 5, y: 5 }], links: [] })).status).toBe(200);
    const after = await getCampaign(campaign.id);
    expect(after.scenes.find((s) => s.id === a.id)?.updatedAt).toBe(a.updatedAt);
  });

  it("replaces the previous links", async () => {
    const { campaign, a, b, c } = await withScenes("Replace");
    const scenes = [a, b, c].map((s) => ({ id: s.id, x: 0, y: 0 }));
    expect(
      (
        await putGraph(campaign.id, {
          scenes,
          links: [
            { id: "l1", source: a.id, target: b.id, label: "one" },
            { id: "l2", source: b.id, target: c.id, label: "two" },
          ],
        })
      ).status,
    ).toBe(200);
    expect((await getCampaign(campaign.id)).links).toHaveLength(2);

    expect(
      (await putGraph(campaign.id, { scenes, links: [{ id: "l3", source: a.id, target: c.id, label: "only" }] })).status,
    ).toBe(200);
    expect((await getCampaign(campaign.id)).links).toEqual([{ id: "l3", source: a.id, target: c.id, label: "only" }]);

    expect((await putGraph(campaign.id, { scenes, links: [] })).status).toBe(200);
    expect((await getCampaign(campaign.id)).links).toEqual([]);
  });

  it("stores more links than fit in one insert statement", async () => {
    const campaign = await createCampaign(alice, "Many links");
    const scenes: Scene[] = [];
    for (let i = 0; i < 12; i++) scenes.push(await createScene(campaign.id, `S${i}`));
    const links = scenes
      .flatMap((from, i) => scenes.slice(i + 1).map((to) => ({ from, to })))
      .slice(0, 50)
      .map((pair, i) => ({ id: `l${i}`, source: pair.from.id, target: pair.to.id, label: "" }));

    const res = await putGraph(campaign.id, { scenes: scenes.map((s) => ({ id: s.id, x: 0, y: 0 })), links });
    expect(res.status).toBe(200);
    expect((await getCampaign(campaign.id)).links).toHaveLength(50);
  });

  it("updates only the scenes listed in the body", async () => {
    const { campaign, a, b } = await withScenes("Partial");
    expect((await putGraph(campaign.id, { scenes: [{ id: b.id, x: 9, y: 9 }], links: [] })).status).toBe(200);
    expect(
      (await putGraph(campaign.id, { scenes: [{ id: a.id, x: 100, y: 200 }], links: [] })).status,
    ).toBe(200);

    const after = await getCampaign(campaign.id);
    const positions = Object.fromEntries(after.scenes.map((s) => [s.id, { x: s.x, y: s.y }]));
    expect(positions[a.id]).toEqual({ x: 100, y: 200 });
    expect(positions[b.id]).toEqual({ x: 9, y: 9 });
  });

  it("rejects a scene id from another campaign and writes nothing", async () => {
    const { campaign, a } = await withScenes("Mine");
    const other = await createCampaign(alice, "Other");
    const stranger = await createScene(other.id, "Elsewhere");
    expect(
      (
        await putGraph(campaign.id, {
          scenes: [{ id: a.id, x: 1, y: 1 }],
          links: [],
        })
      ).status,
    ).toBe(200);

    const res = await putGraph(campaign.id, {
      scenes: [
        { id: a.id, x: 50, y: 50 },
        { id: stranger.id, x: 50, y: 50 },
      ],
      links: [{ id: "l1", source: a.id, target: stranger.id, label: "" }],
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown scene", details: { id: stranger.id } });

    const after = await getCampaign(campaign.id);
    expect(after.scenes.find((s) => s.id === a.id)).toMatchObject({ x: 1, y: 1 });
    expect(after.links).toEqual([]);
  });

  it("rejects a link to a scene that is not in the body", async () => {
    const { campaign, a, b } = await withScenes("Dangling link");
    const res = await putGraph(campaign.id, {
      scenes: [{ id: a.id, x: 0, y: 0 }],
      links: [{ id: "l1", source: a.id, target: b.id, label: "" }],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Unknown target scene");
    expect((await getCampaign(campaign.id)).links).toEqual([]);
  });

  it("rejects a self-link", async () => {
    const { campaign, a } = await withScenes("Self");
    const res = await putGraph(campaign.id, {
      scenes: [{ id: a.id, x: 0, y: 0 }],
      links: [{ id: "l1", source: a.id, target: a.id, label: "" }],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Self-link");
  });

  it("rejects a duplicate link id", async () => {
    const { campaign, a, b, c } = await withScenes("Duplicate id");
    const res = await putGraph(campaign.id, {
      scenes: [a, b, c].map((s) => ({ id: s.id, x: 0, y: 0 })),
      links: [
        { id: "l1", source: a.id, target: b.id, label: "" },
        { id: "l1", source: b.id, target: c.id, label: "" },
      ],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Duplicate link id");
  });

  it("rejects the same directed pair twice", async () => {
    const { campaign, a, b } = await withScenes("Duplicate pair");
    const res = await putGraph(campaign.id, {
      scenes: [a, b].map((s) => ({ id: s.id, x: 0, y: 0 })),
      links: [
        { id: "l1", source: a.id, target: b.id, label: "" },
        { id: "l2", source: a.id, target: b.id, label: "again" },
      ],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Duplicate link");
  });

  it("returns 404 for another user's campaign and leaves it alone", async () => {
    const { campaign, a, b } = await withScenes("Not yours");
    expect(
      (
        await putGraph(campaign.id, {
          scenes: [a, b].map((s) => ({ id: s.id, x: 7, y: 7 })),
          links: [{ id: "l1", source: a.id, target: b.id, label: "kept" }],
        })
      ).status,
    ).toBe(200);

    const res = await putGraph(campaign.id, { scenes: [], links: [] }, bob);
    expect(res.status).toBe(404);
    const after = await getCampaign(campaign.id);
    expect(after.links).toHaveLength(1);
    expect(after.scenes.find((s) => s.id === a.id)).toMatchObject({ x: 7, y: 7 });
    expect(after.scenes.find((s) => s.id === b.id)).toMatchObject({ x: 7, y: 7 });
  });

  it("requires a session", async () => {
    const { campaign } = await withScenes("Anon");
    const res = await jsonRequest(`/campaigns/${campaign.id}/graph`, "PUT", { scenes: [], links: [] });
    expect(res.status).toBe(401);
  });
});

describe("scene deletion", () => {
  it("cascades to the links that reference the scene", async () => {
    const { campaign, a, b, c } = await withScenes("Cascade");
    expect(
      (
        await putGraph(campaign.id, {
          scenes: [a, b, c].map((s) => ({ id: s.id, x: 0, y: 0 })),
          links: [
            { id: "l1", source: a.id, target: b.id, label: "" },
            { id: "l2", source: b.id, target: c.id, label: "" },
            { id: "l3", source: a.id, target: c.id, label: "" },
          ],
        })
      ).status,
    ).toBe(200);

    const del = await request(`/scenes/${b.id}`, { method: "DELETE", headers: cookieHeader(alice) });
    expect(del.status).toBe(204);

    const after = await getCampaign(campaign.id);
    expect(after.scenes.map((s) => s.id).sort()).toEqual([a.id, c.id].sort());
    expect(after.links).toEqual([{ id: "l3", source: a.id, target: c.id, label: "" }]);
  });
});

describe("POST /campaigns/:id/scenes positions", () => {
  it("stores the supplied x and y", async () => {
    const campaign = await createCampaign(alice, "Placed");
    const res = await jsonRequest(
      `/campaigns/${campaign.id}/scenes`,
      "POST",
      { name: "Placed", x: -12.5, y: 340 },
      alice,
    );
    expect(res.status).toBe(201);
    const { scene } = (await res.json()) as { scene: Scene };
    expect(scene).toMatchObject({ x: -12.5, y: 340 });
    expect((await getCampaign(campaign.id)).scenes[0]).toMatchObject({ x: -12.5, y: 340 });
  });

  it("defaults x and y to 0", async () => {
    const campaign = await createCampaign(alice, "Unplaced");
    const scene = await createScene(campaign.id, "Unplaced");
    expect(scene).toMatchObject({ x: 0, y: 0 });
    expect((await getCampaign(campaign.id)).scenes[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("rejects a non-numeric position", async () => {
    const campaign = await createCampaign(alice, "Bad position");
    const res = await jsonRequest(`/campaigns/${campaign.id}/scenes`, "POST", { name: "Bad", x: "left" }, alice);
    expect(res.status).toBe(400);
  });
});
