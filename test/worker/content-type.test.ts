import { describe, expect, it } from "vitest";
import { cookieHeader, registerAndLogin, request } from "./helpers";

describe("JSON endpoints", () => {
  it("reject bodies that are not declared application/json", async () => {
    const res = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: '{"email":"x@example.com","password":"password123"}',
    });
    expect(res.status).toBe(415);
  });

  it("reject form posts even with a valid session", async () => {
    const { cookie } = await registerAndLogin("ct@example.com");
    const res = await request("/campaigns", {
      method: "POST",
      headers: { ...cookieHeader(cookie), "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=x",
    });
    expect(res.status).toBe(415);
  });

  it("return 400 for malformed percent-encoding in a path param", async () => {
    const res = await request("/campaigns/%E0", { method: "GET" });
    expect(res.status).toBe(400);
  });
});
