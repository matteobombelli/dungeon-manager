import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { Campaign, Scene, SceneLink } from "../../shared/api";
import { cookieHeader, jsonRequest, registerAndLogin, request } from "./helpers";

// D1 state persists across tests within a file, so every registration needs its own email.
let alice = "";
let bob = "";

beforeAll(async () => {
  alice = (await registerAndLogin("alice@campaigns.test")).cookie;
  bob = (await registerAndLogin("bob@campaigns.test")).cookie;
});

function setCreatedAt(table: "campaigns" | "scenes", id: string, value: number): Promise<unknown> {
  return env.DB.prepare(`UPDATE ${table} SET created_at = ? WHERE id = ?`).bind(value, id).run();
}

async function createCampaign(cookie: string, name: string): Promise<Campaign> {
  const res = await jsonRequest("/campaigns", "POST", { name }, cookie);
  expect(res.status).toBe(201);
  return ((await res.json()) as { campaign: Campaign }).campaign;
}

describe("POST /campaigns", () => {
  it("creates a campaign", async () => {
    const res = await jsonRequest("/campaigns", "POST", { name: "  Curse of Strahd  " }, alice);
    expect(res.status).toBe(201);
    const { campaign } = (await res.json()) as { campaign: Campaign };
    expect(campaign.name).toBe("Curse of Strahd");
    expect(campaign.description).toBe("");
    expect(campaign.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(campaign.createdAt).toBe(campaign.updatedAt);
    expect(Object.keys(campaign).sort()).toEqual(["createdAt", "description", "id", "name", "updatedAt"]);
  });

  it("keeps a supplied description", async () => {
    const res = await jsonRequest("/campaigns", "POST", { name: "Descr", description: "a spooky castle" }, alice);
    const { campaign } = (await res.json()) as { campaign: Campaign };
    expect(campaign.description).toBe("a spooky castle");
  });

  it("rejects an empty name", async () => {
    const res = await jsonRequest("/campaigns", "POST", { name: "   " }, alice);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("Validation failed");
  });

  it("requires a session", async () => {
    const res = await jsonRequest("/campaigns", "POST", { name: "Anon" });
    expect(res.status).toBe(401);
  });
});

describe("GET /campaigns", () => {
  it("lists only the caller's campaigns, newest first", async () => {
    const own = await registerAndLogin("list@campaigns.test");
    const first = await createCampaign(own.cookie, "First");
    const second = await createCampaign(own.cookie, "Second");
    await createCampaign(bob, "Bob's");
    // Two creations can share a millisecond, so pin the timestamps the ordering is asserted on.
    await setCreatedAt("campaigns", first.id, 1000);
    await setCreatedAt("campaigns", second.id, 2000);

    const res = await request("/campaigns", { headers: cookieHeader(own.cookie) });
    expect(res.status).toBe(200);
    const { campaigns } = (await res.json()) as { campaigns: Campaign[] };
    expect(campaigns.map((c) => c.id)).toEqual([second.id, first.id]);
  });

  it("requires a session", async () => {
    const res = await request("/campaigns");
    expect(res.status).toBe(401);
  });
});

describe("GET /campaigns/:id", () => {
  it("returns the campaign with its scenes, newest first", async () => {
    const campaign = await createCampaign(alice, "With scenes");
    const a = await jsonRequest(`/campaigns/${campaign.id}/scenes`, "POST", { name: "Scene A" }, alice);
    const b = await jsonRequest(`/campaigns/${campaign.id}/scenes`, "POST", { name: "Scene B" }, alice);
    const sceneA = ((await a.json()) as { scene: Scene }).scene;
    const sceneB = ((await b.json()) as { scene: Scene }).scene;
    await setCreatedAt("scenes", sceneA.id, 1000);
    await setCreatedAt("scenes", sceneB.id, 2000);

    const res = await request(`/campaigns/${campaign.id}`, { headers: cookieHeader(alice) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { campaign: Campaign; scenes: Scene[]; links: SceneLink[] };
    expect(body.campaign).toEqual(campaign);
    expect(body.scenes.map((s) => s.id)).toEqual([sceneB.id, sceneA.id]);
    expect(body.scenes[1].createdAt).toBe(1000);
    expect(body.scenes[0].campaignId).toBe(campaign.id);
    expect(body.links).toEqual([]);
    expect(Object.keys(body.scenes[0]).sort()).toEqual([
      "campaignId",
      "color",
      "createdAt",
      "id",
      "name",
      "updatedAt",
      "x",
      "y",
    ]);
  });

  it("returns 404 for another user's campaign", async () => {
    const campaign = await createCampaign(alice, "Private");
    const res = await request(`/campaigns/${campaign.id}`, { headers: cookieHeader(bob) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request("/campaigns/does-not-exist", { headers: cookieHeader(alice) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /campaigns/:id", () => {
  it("updates only the provided fields and bumps updatedAt", async () => {
    const campaign = await createCampaign(alice, "Original");
    const res = await jsonRequest(`/campaigns/${campaign.id}`, "PATCH", { description: "now described" }, alice);
    expect(res.status).toBe(200);
    const updated = ((await res.json()) as { campaign: Campaign }).campaign;
    expect(updated.name).toBe("Original");
    expect(updated.description).toBe("now described");
    expect(updated.createdAt).toBe(campaign.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(campaign.updatedAt);

    const after = await request(`/campaigns/${campaign.id}`, { headers: cookieHeader(alice) });
    expect(((await after.json()) as { campaign: Campaign }).campaign).toEqual(updated);
  });

  it("renames", async () => {
    const campaign = await createCampaign(alice, "Before");
    const res = await jsonRequest(`/campaigns/${campaign.id}`, "PATCH", { name: "After" }, alice);
    const updated = ((await res.json()) as { campaign: Campaign }).campaign;
    expect(updated.name).toBe("After");
    expect(updated.description).toBe(campaign.description);
  });

  it("returns 404 for another user's campaign", async () => {
    const campaign = await createCampaign(alice, "Not yours");
    const res = await jsonRequest(`/campaigns/${campaign.id}`, "PATCH", { name: "Stolen" }, bob);
    expect(res.status).toBe(404);
    const after = await request(`/campaigns/${campaign.id}`, { headers: cookieHeader(alice) });
    expect(((await after.json()) as { campaign: Campaign }).campaign.name).toBe("Not yours");
  });
});

describe("DELETE /campaigns/:id", () => {
  it("deletes the campaign and cascades to its scenes", async () => {
    const campaign = await createCampaign(alice, "Doomed");
    const sceneRes = await jsonRequest(`/campaigns/${campaign.id}/scenes`, "POST", { name: "Doomed scene" }, alice);
    const scene = ((await sceneRes.json()) as { scene: Scene }).scene;

    const res = await request(`/campaigns/${campaign.id}`, { method: "DELETE", headers: cookieHeader(alice) });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");

    expect((await request(`/campaigns/${campaign.id}`, { headers: cookieHeader(alice) })).status).toBe(404);
    expect((await request(`/scenes/${scene.id}`, { headers: cookieHeader(alice) })).status).toBe(404);
  });

  it("returns 404 for another user's campaign and leaves it alone", async () => {
    const campaign = await createCampaign(alice, "Survivor");
    const res = await request(`/campaigns/${campaign.id}`, { method: "DELETE", headers: cookieHeader(bob) });
    expect(res.status).toBe(404);
    expect((await request(`/campaigns/${campaign.id}`, { headers: cookieHeader(alice) })).status).toBe(200);
  });
});

describe("POST /campaigns/:id/scenes", () => {
  it("creates a scene owned by the campaign owner", async () => {
    const campaign = await createCampaign(alice, "Scene host");
    const res = await jsonRequest(`/campaigns/${campaign.id}/scenes`, "POST", { name: "Opening" }, alice);
    expect(res.status).toBe(201);
    const { scene } = (await res.json()) as { scene: Scene };
    expect(scene.name).toBe("Opening");
    expect(scene.campaignId).toBe(campaign.id);
    expect(scene.createdAt).toBe(scene.updatedAt);

    // The owner can read it back; another user cannot.
    expect((await request(`/scenes/${scene.id}`, { headers: cookieHeader(alice) })).status).toBe(200);
    expect((await request(`/scenes/${scene.id}`, { headers: cookieHeader(bob) })).status).toBe(404);
  });

  it("returns 404 when the campaign belongs to another user", async () => {
    const campaign = await createCampaign(alice, "No trespassing");
    const res = await jsonRequest(`/campaigns/${campaign.id}/scenes`, "POST", { name: "Sneaky" }, bob);
    expect(res.status).toBe(404);
    const after = await request(`/campaigns/${campaign.id}`, { headers: cookieHeader(alice) });
    expect(((await after.json()) as { scenes: Scene[] }).scenes).toEqual([]);
  });

  it("validates the body", async () => {
    const campaign = await createCampaign(alice, "Validation");
    const res = await jsonRequest(`/campaigns/${campaign.id}/scenes`, "POST", { name: "" }, alice);
    expect(res.status).toBe(400);
  });
});
