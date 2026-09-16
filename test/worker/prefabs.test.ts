import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { Prefab } from "../../shared/api";
import type { PrefabField } from "../../shared/prefab";
import { cookieHeader, jsonRequest, registerAndLogin, request } from "./helpers";

// D1 state persists across tests within a file, so every registration needs its own email.
let alice = "";
let bob = "";

beforeAll(async () => {
  alice = (await registerAndLogin("alice@prefabs.test")).cookie;
  bob = (await registerAndLogin("bob@prefabs.test")).cookie;
});

const FIELDS: PrefabField[] = [
  { key: "shop_name", label: "Shop name", kind: "text" },
  { key: "gold", label: "Gold", kind: "number" },
  { key: "sign", label: "Sign", kind: "image" },
];

async function createPrefab(cookie: string, name: string, fields: PrefabField[] = FIELDS): Promise<Prefab> {
  const res = await jsonRequest("/prefabs", "POST", { name, fields }, cookie);
  expect(res.status).toBe(201);
  return ((await res.json()) as { prefab: Prefab }).prefab;
}

describe("POST /prefabs", () => {
  it("creates a prefab", async () => {
    const prefab = await createPrefab(alice, "  Shop  ");
    expect(prefab.name).toBe("Shop");
    expect(prefab.fields).toEqual(FIELDS);
    expect(prefab.createdAt).toBe(prefab.updatedAt);
    expect(Object.keys(prefab).sort()).toEqual(["createdAt", "fields", "id", "name", "updatedAt"]);
  });

  it("rejects a bad field key", async () => {
    const res = await jsonRequest(
      "/prefabs",
      "POST",
      { name: "Bad key", fields: [{ key: "Shop Name", label: "Shop name", kind: "text" }] },
      alice,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("Validation failed");
  });

  it("rejects duplicate field keys", async () => {
    const res = await jsonRequest(
      "/prefabs",
      "POST",
      {
        name: "Dupes",
        fields: [
          { key: "gold", label: "Gold", kind: "number" },
          { key: "gold", label: "More gold", kind: "number" },
        ],
      },
      alice,
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify((await res.json()) as unknown)).toContain("unique");
  });

  it("rejects an empty field list", async () => {
    const res = await jsonRequest("/prefabs", "POST", { name: "Empty", fields: [] }, alice);
    expect(res.status).toBe(400);
  });

  it("rejects an unknown field kind", async () => {
    const res = await jsonRequest(
      "/prefabs",
      "POST",
      { name: "Bad kind", fields: [{ key: "gold", label: "Gold", kind: "money" }] },
      alice,
    );
    expect(res.status).toBe(400);
  });

  it("requires a session", async () => {
    const res = await jsonRequest("/prefabs", "POST", { name: "Anon", fields: FIELDS });
    expect(res.status).toBe(401);
  });
});

describe("GET /prefabs", () => {
  it("lists only the caller's prefabs, newest first", async () => {
    const own = (await registerAndLogin("list@prefabs.test")).cookie;
    const first = await createPrefab(own, "First");
    const second = await createPrefab(own, "Second");
    await createPrefab(bob, "Bob's");
    // Two creations can share a millisecond, so pin the timestamps the ordering is asserted on.
    await env.DB.prepare("UPDATE prefabs SET created_at = 1000 WHERE id = ?").bind(first.id).run();
    await env.DB.prepare("UPDATE prefabs SET created_at = 2000 WHERE id = ?").bind(second.id).run();

    const res = await request("/prefabs", { headers: cookieHeader(own) });
    expect(res.status).toBe(200);
    const { prefabs } = (await res.json()) as { prefabs: Prefab[] };
    expect(prefabs.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(prefabs[0].fields).toEqual(FIELDS);
  });

  it("requires a session", async () => {
    const res = await request("/prefabs");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /prefabs/:id", () => {
  it("updates only the provided fields and bumps updatedAt", async () => {
    const prefab = await createPrefab(alice, "Renameable");
    const res = await jsonRequest(`/prefabs/${prefab.id}`, "PATCH", { name: "Renamed" }, alice);
    expect(res.status).toBe(200);
    const updated = ((await res.json()) as { prefab: Prefab }).prefab;
    expect(updated.name).toBe("Renamed");
    expect(updated.fields).toEqual(FIELDS);
    expect(updated.createdAt).toBe(prefab.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(prefab.updatedAt);
  });

  it("replaces the field list", async () => {
    const prefab = await createPrefab(alice, "Refields");
    const fields: PrefabField[] = [{ key: "note", label: "Note", kind: "text" }];
    const res = await jsonRequest(`/prefabs/${prefab.id}`, "PATCH", { fields }, alice);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { prefab: Prefab }).prefab).toMatchObject({ name: "Refields", fields });

    const list = await request("/prefabs", { headers: cookieHeader(alice) });
    const stored = ((await list.json()) as { prefabs: Prefab[] }).prefabs.find((p) => p.id === prefab.id);
    expect(stored?.fields).toEqual(fields);
  });

  it("rejects invalid fields", async () => {
    const prefab = await createPrefab(alice, "Guarded");
    const res = await jsonRequest(`/prefabs/${prefab.id}`, "PATCH", { fields: [] }, alice);
    expect(res.status).toBe(400);
  });

  it("returns 404 for another user's prefab", async () => {
    const prefab = await createPrefab(alice, "Not yours");
    const res = await jsonRequest(`/prefabs/${prefab.id}`, "PATCH", { name: "Stolen" }, bob);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});

describe("DELETE /prefabs/:id", () => {
  it("deletes the prefab", async () => {
    const own = (await registerAndLogin("delete@prefabs.test")).cookie;
    const prefab = await createPrefab(own, "Doomed");
    const res = await request(`/prefabs/${prefab.id}`, { method: "DELETE", headers: cookieHeader(own) });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");

    const list = await request("/prefabs", { headers: cookieHeader(own) });
    expect(((await list.json()) as { prefabs: Prefab[] }).prefabs).toEqual([]);
  });

  it("returns 404 for another user's prefab and leaves it alone", async () => {
    const own = (await registerAndLogin("survivor@prefabs.test")).cookie;
    const prefab = await createPrefab(own, "Survivor");
    const res = await request(`/prefabs/${prefab.id}`, { method: "DELETE", headers: cookieHeader(bob) });
    expect(res.status).toBe(404);

    const list = await request("/prefabs", { headers: cookieHeader(own) });
    expect(((await list.json()) as { prefabs: Prefab[] }).prefabs.map((p) => p.id)).toEqual([prefab.id]);
  });
});
