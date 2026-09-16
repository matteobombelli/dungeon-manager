import { expect, it } from "vitest";
import { request } from "./helpers";

it("reports D1 and R2 healthy", async () => {
  const res = await request("/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, d1: true, r2: true });
});
