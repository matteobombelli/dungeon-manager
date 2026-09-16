import { describe, expect, it } from "vitest";
import { StatblockSchema, defaultData } from "../../shared/nodes/statblock";

describe("StatblockSchema hiddenSections", () => {
  it("accepts known section ids", () => {
    const result = StatblockSchema.safeParse({ ...defaultData(), hiddenSections: ["legendary", "saves"] });
    expect(result.success).toBe(true);
    expect(result.data?.hiddenSections).toEqual(["legendary", "saves"]);
  });

  it("rejects an unknown section id", () => {
    expect(StatblockSchema.safeParse({ ...defaultData(), hiddenSections: ["spells"] }).success).toBe(false);
  });

  it("leaves the field absent when it is not sent", () => {
    const result = StatblockSchema.safeParse(defaultData());
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("hiddenSections");
  });
});
