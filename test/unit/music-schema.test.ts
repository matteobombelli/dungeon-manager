import { describe, expect, it } from "vitest";
import { MusicSchema, defaultData, titleOf } from "../../shared/nodes/music";

describe("MusicSchema", () => {
  it("accepts the default data", () => {
    const result = MusicSchema.safeParse(defaultData());
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: "", assetId: null, loop: false, volume: 0.8 });
  });

  it("accepts an attached asset", () => {
    expect(MusicSchema.safeParse({ ...defaultData(), assetId: "a1" }).success).toBe(true);
  });

  it("rejects a volume outside 0..1", () => {
    expect(MusicSchema.safeParse({ ...defaultData(), volume: 1.5 }).success).toBe(false);
    expect(MusicSchema.safeParse({ ...defaultData(), volume: -0.1 }).success).toBe(false);
  });
});

describe("titleOf", () => {
  it("falls back to Music when the title is empty", () => {
    expect(titleOf(defaultData())).toBe("Music");
    expect(titleOf({ ...defaultData(), title: "Tavern" })).toBe("Tavern");
  });
});
