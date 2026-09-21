import { describe, expect, it } from "vitest";
import { StatblockSchema, defaultData, defaultTracker } from "../../shared/nodes/statblock";

describe("StatblockSchema hiddenSections", () => {
  it("accepts known section ids", () => {
    const result = StatblockSchema.safeParse({ ...defaultData(), hiddenSections: ["legendary", "saves"] });
    expect(result.success).toBe(true);
    expect(result.data?.hiddenSections).toEqual(["legendary", "saves"]);
  });

  it("accepts the encounter section", () => {
    const result = StatblockSchema.safeParse({ ...defaultData(), hiddenSections: ["encounter"] });
    expect(result.success).toBe(true);
    expect(result.data?.hiddenSections).toEqual(["encounter"]);
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

describe("StatblockSchema tracker", () => {
  it("accepts a block without a tracker", () => {
    const result = StatblockSchema.safeParse(defaultData());
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("tracker");
  });

  it("accepts a full tracker", () => {
    const tracker = {
      currentHp: 3,
      tempHp: 2,
      conditions: ["prone"],
      concentrating: true,
      legendaryActionsLeft: 1,
      legendaryResistancesLeft: 0,
    };
    const result = StatblockSchema.safeParse({ ...defaultData(), tracker });
    expect(result.success).toBe(true);
    expect(result.data?.tracker).toEqual(tracker);
  });

  it("accepts the untouched tracker", () => {
    const result = StatblockSchema.safeParse({ ...defaultData(), tracker: defaultTracker() });
    expect(result.success).toBe(true);
  });

  it("rejects negative current hit points", () => {
    const tracker = { ...defaultTracker(), currentHp: -1 };
    expect(StatblockSchema.safeParse({ ...defaultData(), tracker }).success).toBe(false);
  });
});

describe("StatblockSchema legendary counts", () => {
  it("accepts actions per round and resistances", () => {
    const result = StatblockSchema.safeParse({
      ...defaultData(),
      legendaryActionsPerRound: 3,
      legendaryResistances: 2,
    });
    expect(result.success).toBe(true);
    expect(result.data?.legendaryActionsPerRound).toBe(3);
    expect(result.data?.legendaryResistances).toBe(2);
  });

  it("rejects negative counts", () => {
    expect(StatblockSchema.safeParse({ ...defaultData(), legendaryActionsPerRound: -1 }).success).toBe(false);
    expect(StatblockSchema.safeParse({ ...defaultData(), legendaryResistances: -1 }).success).toBe(false);
  });
});
