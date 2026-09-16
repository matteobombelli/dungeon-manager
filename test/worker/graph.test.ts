import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { Campaign, Scene } from "../../shared/api";
import { NODE_TYPE_IDS, NODE_TYPES } from "../../shared/nodes/registry";
import { canonicalEdge, type Graph, type GraphNode } from "../../shared/graph";
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
  it("round-trips one node of every type with its edges", async () => {
    const scene = await createScene("Every type");
    const nodes = NODE_TYPE_IDS.map((type, i) => node(`n-${type}`, type, i * 100 + 0.5, 40 - i * 25.25));
    const edges = nodes.slice(1).map((n, i) => ({
      id: `e${i}`,
      source: nodes[i].id,
      target: n.id,
      label: `step ${i}`,
    }));

    const res = await putGraph(scene.id, { nodes, edges });
    expect(res.status).toBe(200);
    const { updatedAt } = (await res.json()) as { updatedAt: number };
    expect(typeof updatedAt).toBe("number");

    const after = await getGraph(scene.id);
    expect(after.graph.nodes).toEqual(nodes);
    expect(after.graph.edges).toEqual(expect.arrayContaining(edges.map(canonicalEdge)));
    expect(after.graph.edges).toHaveLength(edges.length);
    expect(after.scene.updatedAt).toBe(updatedAt);
  });

  it("round-trips a node colour", async () => {
    const scene = await createScene("Coloured");
    const nodes = [{ ...node("a", "music"), color: "#AABBCC" }, node("b", "event")];
    expect((await putGraph(scene.id, { nodes, edges: [] })).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes).toEqual(nodes);
  });

  it("preserves node order", async () => {
    const scene = await createScene("Order");
    const nodes = ["c", "a", "b", "z", "d"].map((id) => node(id, "event"));
    expect((await putGraph(scene.id, { nodes, edges: [] })).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes.map((n) => n.id)).toEqual(["c", "a", "b", "z", "d"]);
  });

  it("replaces the previous graph, dropping removed nodes and their edges", async () => {
    const scene = await createScene("Replace");
    const nodes = [node("a", "character"), node("b", "event"), node("c", "custom")];
    const edges = [
      { id: "e1", source: "a", target: "b", label: "first" },
      { id: "e2", source: "b", target: "c", label: "second" },
    ];
    expect((await putGraph(scene.id, { nodes, edges })).status).toBe(200);
    expect((await getGraph(scene.id)).graph.edges).toHaveLength(2);

    expect((await putGraph(scene.id, { nodes: [nodes[0]], edges: [] })).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(after.graph.edges).toEqual([]);

    const counts = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM nodes WHERE scene_id = ?1) AS nodes, (SELECT COUNT(*) FROM edges WHERE scene_id = ?1) AS edges",
    )
      .bind(scene.id)
      .first<{ nodes: number; edges: number }>();
    expect(counts).toEqual({ nodes: 1, edges: 0 });
  });

  it("accepts an empty graph", async () => {
    const scene = await createScene("Emptied");
    expect((await putGraph(scene.id, { nodes: [node("a", "map")], edges: [] })).status).toBe(200);
    const res = await putGraph(scene.id, { nodes: [], edges: [] });
    expect(res.status).toBe(200);
    expect((await getGraph(scene.id)).graph).toEqual({ nodes: [], edges: [] });
  });

  it("keeps edited node data", async () => {
    const scene = await createScene("Edited data");
    const data = { ...NODE_TYPES.character.defaultData(), name: "Vasilka", level: 7, isPlayer: true };
    expect((await putGraph(scene.id, { nodes: [{ id: "a", type: "character", x: 1, y: 2, data }], edges: [] })).status).toBe(
      200,
    );
    const after = await getGraph(scene.id);
    expect(after.graph.nodes[0].data).toEqual(data);
  });

  it("updates the scene timestamp", async () => {
    const scene = await createScene("Touched");
    await env.DB.prepare("UPDATE scenes SET updated_at = 1000 WHERE id = ?").bind(scene.id).run();
    const res = await putGraph(scene.id, { nodes: [], edges: [] });
    const { updatedAt } = (await res.json()) as { updatedAt: number };
    expect(updatedAt).toBeGreaterThan(1000);
    expect((await getGraph(scene.id)).scene.updatedAt).toBe(updatedAt);
  });

  it("rejects invalid node data with details", async () => {
    const scene = await createScene("Bad data");
    const data = { ...NODE_TYPES.character.defaultData(), level: 99 };
    const res = await putGraph(scene.id, { nodes: [{ id: "a", type: "character", x: 0, y: 0, data }], edges: [] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown };
    expect(body.error).toBe("Validation failed");
    expect(JSON.stringify(body.details)).toContain("level");
    expect((await getGraph(scene.id)).graph.nodes).toEqual([]);
  });

  it("rejects an unknown node type", async () => {
    const scene = await createScene("Bad type");
    const res = await putGraph(scene.id, { nodes: [{ id: "a", type: "wizard", x: 0, y: 0, data: {} }], edges: [] });
    expect(res.status).toBe(400);
  });

  it("stores edges canonically, with source before target", async () => {
    const scene = await createScene("Canonical");
    const nodes = [node("a", "event"), node("b", "map")];
    expect(
      (await putGraph(scene.id, { nodes, edges: [{ id: "e1", source: "b", target: "a", label: "beside" }] })).status,
    ).toBe(200);

    const row = await env.DB.prepare("SELECT source, target FROM edges WHERE scene_id = ?")
      .bind(scene.id)
      .first<{ source: string; target: string }>();
    expect(row).toEqual({ source: "a", target: "b" });
    expect((await getGraph(scene.id)).graph.edges).toEqual([{ id: "e1", source: "a", target: "b", label: "beside" }]);
  });

  it("rejects a self-loop", async () => {
    const scene = await createScene("Self-loop");
    const res = await putGraph(scene.id, {
      nodes: [node("a", "event")],
      edges: [{ id: "e1", source: "a", target: "a", label: "" }],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Self-loop");
  });

  it("rejects the same pair of nodes connected in reverse", async () => {
    const scene = await createScene("Reverse duplicate");
    const res = await putGraph(scene.id, {
      nodes: [node("a", "event"), node("b", "map")],
      edges: [
        { id: "e1", source: "a", target: "b", label: "" },
        { id: "e2", source: "b", target: "a", label: "" },
      ],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Duplicate edge");
    expect((await getGraph(scene.id)).graph.edges).toEqual([]);
  });

  it("rejects an edge pointing at a missing node", async () => {
    const scene = await createScene("Dangling");
    const res = await putGraph(scene.id, {
      nodes: [node("a", "event")],
      edges: [{ id: "e1", source: "a", target: "ghost", label: "" }],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Unknown target node");
  });

  it("rejects duplicate node ids", async () => {
    const scene = await createScene("Duplicate");
    const res = await putGraph(scene.id, { nodes: [node("a", "event"), node("a", "custom")], edges: [] });
    expect(res.status).toBe(400);
    expect(JSON.stringify(((await res.json()) as { details: unknown }).details)).toContain("Duplicate node id");
  });

  it("rejects more than 500 nodes", async () => {
    const scene = await createScene("Too many");
    const nodes = Array.from({ length: 501 }, (_, i) => node(`n${i}`, "event"));
    const res = await putGraph(scene.id, { nodes, edges: [] });
    expect(res.status).toBe(400);
  });

  it("stores a large graph in one batch", async () => {
    const scene = await createScene("Large");
    const nodes = Array.from({ length: 120 }, (_, i) => node(`n${i}`, "event", i, i));
    const edges = Array.from({ length: 119 }, (_, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: `n${i + 1}`,
      label: "",
    }));
    expect((await putGraph(scene.id, { nodes, edges })).status).toBe(200);
    const after = await getGraph(scene.id);
    expect(after.graph.nodes).toEqual(nodes);
    expect(after.graph.edges).toHaveLength(119);
  });

  it("returns 404 for another user's scene and leaves the graph alone", async () => {
    const scene = await createScene("Not yours");
    expect((await putGraph(scene.id, { nodes: [node("a", "event")], edges: [] })).status).toBe(200);
    const res = await putGraph(scene.id, { nodes: [], edges: [] }, bob);
    expect(res.status).toBe(404);
    expect((await getGraph(scene.id)).graph.nodes).toHaveLength(1);
  });

  it("requires a session", async () => {
    const scene = await createScene("Anon");
    const res = await jsonRequest(`/scenes/${scene.id}/graph`, "PUT", { nodes: [], edges: [] });
    expect(res.status).toBe(401);
  });
});
