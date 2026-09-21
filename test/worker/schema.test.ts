import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { request } from "./helpers";

describe("v1.3 removals", () => {
  it("has no edges or prefabs table", async () => {
    const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
    const names = tables.results.map((t) => t.name);
    expect(names).toContain("nodes");
    expect(names).not.toContain("edges");
    expect(names).not.toContain("prefabs");
  });

  it("has no prefabs route", async () => {
    expect((await request("/prefabs")).status).toBe(404);
  });
});
