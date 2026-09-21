import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { Campaign, Scene } from "../../shared/api";
import { NODE_TYPE_IDS, NODE_TYPES } from "../../shared/nodes/registry";
import { type Graph, type GraphNode } from "../../shared/graph";
import { cookieHeader, jsonRequest, registerAndLogin, request } from "./helpers";

// D1 state persists across tests within a file, so every registration needs its own email.
let alice = "";
let bob = "";
let campaignId = "";

beforeAll(async () => {
  alice = (await registerAndLogin("alice@graph.test")).cookie;
  bob = (await registerAndLogin("bob@graph.test")).cookie;
  const res = await jsonRequest("/campaigns", "POST", { name: "Graphs" }, alice);
  campaignId = ((await res.json()) as { campaign: Campaign }).campaign.id;
});

async function createScene(name: string): Promise<Scene> {
  const res = await jsonRequest(`/campaigns/${campaignId}/scenes`, "POST", { name }, alice);
  return ((await res.json()) as { scene: Scene }).scene;
}

function node(id: string, type: GraphNode["type"], x = 0, y = 0): GraphNode {
  return { id, type, x, y, color: null, data: NODE_TYPES[type].defaultData() };
}

function putGraph(sceneId: string, graph: unknown, cookie = alice): Promise<Response> {
  return jsonRequest(`/scenes/${sceneId}/graph`, "PUT", graph, cookie);
}

async function getGraph(sceneId: string, cookie = alice): Promise<{ scene: Scene; graph: Graph }> {
  const res = await request(`/scenes/${sceneId}`, { headers: cookieHeader(cookie) });
  expect(res.status).toBe(200);
  return (await res.json()) as { scene: Scene; graph: Graph };
}

describe("PUT /scenes/:id/graph", () => {
  it("round-trips one node of every type", async () => {
    const scene = await createScene("Every type");
    const nodes = NODE_TYPE_IDS.map((type, i) => node(`n-${type}`, type, i * 100 + 0.5, 40 - i * 25.25));

    const res = await putGraph(scene.id, { nodes });
    expect(res.status).toBe(200);
    const { updatedAt } = (await res.json()) as { updatedAt: number };
    expect(typeof updatedAt).toBe("number");

    const after = await getGraph(scene.id);
    expect(after.graph.nodes).toEqual(nodes);
    expect(after.scene.updatedAt).toBe(updatedAt);
  });

  it("round-trips a node colour", async () => {
    const scene = await createScene("Coloured");
    const nodes = [{ ...node("a", "music"), color: "#AABBCC" }, node("b", "event")];
    expect((await putGraph(scene.id, { nodes})).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes).toEqual(nodes);
  });

  it("preserves node order", async () => {
    const scene = await createScene("Order");
    const nodes = ["c", "a", "b", "z", "d"].map((id) => node(id, "event"));
    expect((await putGraph(scene.id, { nodes})).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes.map((n) => n.id)).toEqual(["c", "a", "b", "z", "d"]);
  });

  it("replaces the previous graph, dropping removed nodes", async () => {
    const scene = await createScene("Replace");
    const nodes = [node("a", "character"), node("b", "event"), node("c", "custom")];
    expect((await putGraph(scene.id, { nodes })).status).toBe(200);
    expect((await getGraph(scene.id)).graph.nodes).toHaveLength(3);

    expect((await putGraph(scene.id, { nodes: [nodes[0]] })).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes.map((n) => n.id)).toEqual(["a"]);

    const counts = await env.DB.prepare("SELECT COUNT(*) AS nodes FROM nodes WHERE scene_id = ?1")
      .bind(scene.id)
      .first<{ nodes: number }>();
    expect(counts).toEqual({ nodes: 1 });
  });

  it("accepts an empty graph", async () => {
    const scene = await createScene("Emptied");
    expect((await putGraph(scene.id, { nodes: [node("a", "map")]})).status).toBe(200);
    const res = await putGraph(scene.id, { nodes: []});
    expect(res.status).toBe(200);
    expect((await getGraph(scene.id)).graph).toEqual({ nodes: []});
  });

  it("keeps edited node data", async () => {
    const scene = await createScene("Edited data");
    const data = { ...NODE_TYPES.character.defaultData(), name: "Vasilka", level: 7, isPlayer: true };
    expect((await putGraph(scene.id, { nodes: [{ id: "a", type: "character", x: 1, y: 2, data }]})).status).toBe(
      200,
    );
    const after = await getGraph(scene.id);
    expect(after.graph.nodes[0].data).toEqual(data);
  });

  it("round-trips a group of two nodes and a tracked stat block", async () => {
    const scene = await createScene("Group and tracker");
    const group = {
      ...node("g", "group", 5, 6),
      data: {
        name: "Ambush",
        nodes: [
          { id: "c1", type: "character", x: 10, y: 20, color: null, data: NODE_TYPES.character.defaultData() },
          { id: "c2", type: "event", x: -4, y: 8, color: "#AABBCC", data: NODE_TYPES.event.defaultData() },
        ],
      },
    };
    const block = {
      ...node("s", "statblock", 100, 0),
      data: {
        ...NODE_TYPES.statblock.defaultData(),
        legendaryActionsPerRound: 3,
        legendaryResistances: 2,
        tracker: {
          currentHp: 3,
          tempHp: 2,
          conditions: ["prone"],
          concentrating: true,
          legendaryActionsLeft: 1,
          legendaryResistancesLeft: 0,
        },
      },
    };

    expect((await putGraph(scene.id, { nodes: [group, block] })).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes).toEqual([group, block]);
  });

  it("ignores an edges key left over from v1.2", async () => {
    const scene = await createScene("Stale edges");
    const nodes = [node("a", "event"), node("b", "event")];
    const res = await putGraph(scene.id, { nodes, edges: [{ id: "e1", source: "a", target: "b" }] });
    expect(res.status).toBe(200);
    expect((await getGraph(scene.id)).graph).toEqual({ nodes });
  });

  it("updates the scene timestamp", async () => {
    const scene = await createScene("Touched");
    await env.DB.prepare("UPDATE scenes SET updated_at = 1000 WHERE id = ?").bind(scene.id).run();
    const res = await putGraph(scene.id, { nodes: []});
    const { updatedAt } = (await res.json()) as { updatedAt: number };
    expect(updatedAt).toBeGreaterThan(1000);
    expect((await getGraph(scene.id)).scene.updatedAt).toBe(updatedAt);
  });

  it("rejects invalid node data with details", async () => {
    const scene = await createScene("Bad data");
    const data = { ...NODE_TYPES.character.defaultData(), level: 99 };
    const res = await putGraph(scene.id, { nodes: [{ id: "a", type: "character", x: 0, y: 0, data }]});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown };
    expect(body.error).toBe("Validation failed");
    expect(JSON.stringify(body.details)).toContain("level");
    expect((await getGraph(scene.id)).graph.nodes).toEqual([]);
  });

  it("rejects an unknown node type", async () => {
    const scene = await createScene("Bad type");
    const res = await putGraph(scene.id, { nodes: [{ id: "a", type: "wizard", x: 0, y: 0, data: {} }]});
    expect(res.status).toBe(400);
  });

  it("rejects duplicate node ids", async () => {
    const scene = await createScene("Duplicate");
    const res = await putGraph(scene.id, { nodes: [node("a", "event"), node("a", "custom")]});
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Duplicate node id");
  });

  it("rejects more than 500 nodes", async () => {
    const scene = await createScene("Too many");
    const nodes = Array.from({ length: 501 }, (_, i) => node(`n${i}`, "event"));
    const res = await putGraph(scene.id, { nodes});
    expect(res.status).toBe(400);
  });

  it("stores a large graph in one batch", async () => {
    const scene = await createScene("Large");
    const nodes = Array.from({ length: 120 }, (_, i) => node(`n${i}`, "event", i, i));
    expect((await putGraph(scene.id, { nodes })).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes).toEqual(nodes);
  });

  it("returns 404 for another user's scene and leaves the graph alone", async () => {
    const scene = await createScene("Not yours");
    expect((await putGraph(scene.id, { nodes: [node("a", "event")]})).status).toBe(200);
    const res = await putGraph(scene.id, { nodes: []}, bob);
    expect(res.status).toBe(404);
    expect((await getGraph(scene.id)).graph.nodes).toHaveLength(1);
  });

  it("requires a session", async () => {
    const scene = await createScene("Anon");
    const res = await jsonRequest(`/scenes/${scene.id}/graph`, "PUT", { nodes: []});
    expect(res.status).toBe(401);
  });
});
