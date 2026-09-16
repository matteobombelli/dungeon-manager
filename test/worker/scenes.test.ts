import { beforeAll, describe, expect, it } from "vitest";
import type { Campaign, Scene } from "../../shared/api";
import type { Graph } from "../../shared/graph";
import { cookieHeader, jsonRequest, registerAndLogin, request } from "./helpers";

// D1 state persists across tests within a file, so every registration needs its own email.
let alice = "";
let bob = "";
let campaignId = "";

beforeAll(async () => {
  alice = (await registerAndLogin("alice@scenes.test")).cookie;
  bob = (await registerAndLogin("bob@scenes.test")).cookie;
  const res = await jsonRequest("/campaigns", "POST", { name: "Scenes" }, alice);
  campaignId = ((await res.json()) as { campaign: Campaign }).campaign.id;
});

async function createScene(name: string): Promise<Scene> {
  const res = await jsonRequest(`/campaigns/${campaignId}/scenes`, "POST", { name }, alice);
  expect(res.status).toBe(201);
  return ((await res.json()) as { scene: Scene }).scene;
}

describe("GET /scenes/:id", () => {
  it("returns the scene with an empty graph", async () => {
    const scene = await createScene("Empty");
    const res = await request(`/scenes/${scene.id}`, { headers: cookieHeader(alice) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scene: Scene; graph: Graph };
    expect(body.scene).toEqual(scene);
    expect(body.graph).toEqual({ nodes: [], edges: [] });
  });

  it("returns 404 for another user's scene", async () => {
    const scene = await createScene("Private");
    const res = await request(`/scenes/${scene.id}`, { headers: cookieHeader(bob) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request("/scenes/nope", { headers: cookieHeader(alice) });
    expect(res.status).toBe(404);
  });

  it("requires a session", async () => {
    const scene = await createScene("Anon");
    const res = await request(`/scenes/${scene.id}`);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /scenes/:id", () => {
  it("renames the scene and bumps updatedAt", async () => {
    const scene = await createScene("Before");
    const res = await jsonRequest(`/scenes/${scene.id}`, "PATCH", { name: "  After  " }, alice);
    expect(res.status).toBe(200);
    const updated = ((await res.json()) as { scene: Scene }).scene;
    expect(updated.name).toBe("After");
    expect(updated.id).toBe(scene.id);
    expect(updated.campaignId).toBe(scene.campaignId);
    expect(updated.createdAt).toBe(scene.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(scene.updatedAt);

    const after = await request(`/scenes/${scene.id}`, { headers: cookieHeader(alice) });
    expect(((await after.json()) as { scene: Scene }).scene).toEqual(updated);
  });

  it("validates the body", async () => {
    const scene = await createScene("Validation");
    const res = await jsonRequest(`/scenes/${scene.id}`, "PATCH", { name: "" }, alice);
    expect(res.status).toBe(400);
  });

  it("returns 404 for another user's scene", async () => {
    const scene = await createScene("Not yours");
    const res = await jsonRequest(`/scenes/${scene.id}`, "PATCH", { name: "Stolen" }, bob);
    expect(res.status).toBe(404);
    const after = await request(`/scenes/${scene.id}`, { headers: cookieHeader(alice) });
    expect(((await after.json()) as { scene: Scene }).scene.name).toBe("Not yours");
  });
});

describe("DELETE /scenes/:id", () => {
  it("deletes the scene but keeps the campaign", async () => {
    const scene = await createScene("Doomed");
    const res = await request(`/scenes/${scene.id}`, { method: "DELETE", headers: cookieHeader(alice) });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect((await request(`/scenes/${scene.id}`, { headers: cookieHeader(alice) })).status).toBe(404);
    expect((await request(`/campaigns/${campaignId}`, { headers: cookieHeader(alice) })).status).toBe(200);
  });

  it("returns 404 for another user's scene and leaves it alone", async () => {
    const scene = await createScene("Survivor");
    const res = await request(`/scenes/${scene.id}`, { method: "DELETE", headers: cookieHeader(bob) });
    expect(res.status).toBe(404);
    expect((await request(`/scenes/${scene.id}`, { headers: cookieHeader(alice) })).status).toBe(200);
  });
});
