import { describe, expect, it } from "vitest";
import { EventSchema, defaultData } from "../../shared/nodes/event";

function withCheck(skill: unknown): unknown {
  return {
    ...defaultData(),
    checks: [{ id: "c1", ability: "dex", skill, dc: 12, successText: "", failureText: "" }],
  };
}

describe("EventSchema checks", () => {
  it("accepts a saving throw", () => {
    expect(EventSchema.safeParse(withCheck("save")).success).toBe(true);
  });

  it("accepts a plain ability check", () => {
    expect(EventSchema.safeParse(withCheck(null)).success).toBe(true);
  });

  it("accepts a known skill", () => {
    expect(EventSchema.safeParse(withCheck("stealth")).success).toBe(true);
  });

  it("rejects a skill that is not in the list", () => {
    expect(EventSchema.safeParse(withCheck("flying")).success).toBe(false);
  });
});

describe("EventSchema hiddenSections", () => {
  it("accepts a known section id", () => {
    const result = EventSchema.safeParse({ ...defaultData(), hiddenSections: ["checks"] });
    expect(result.success).toBe(true);
    expect(result.data?.hiddenSections).toEqual(["checks"]);
  });

  it("rejects an unknown section id", () => {
    expect(EventSchema.safeParse({ ...defaultData(), hiddenSections: ["bogus"] }).success).toBe(false);
  });

  it("leaves the field absent when it is not sent", () => {
    const result = EventSchema.safeParse(defaultData());
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("hiddenSections");
  });
});
