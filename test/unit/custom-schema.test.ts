import { describe, expect, it } from "vitest";
import { CustomNodeSchema, defaultData } from "../../shared/nodes/custom";

describe("CustomNodeSchema", () => {
  it("accepts the default data", () => {
    const result = CustomNodeSchema.safeParse(defaultData());
    expect(result.success).toBe(true);
  });

  it("strips the prefab keys carried by data saved before v1.3", () => {
    const result = CustomNodeSchema.safeParse({ ...defaultData(), prefabId: "p1", prefabName: "Shop" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(defaultData());
  });

  it("rejects a value with no matching field", () => {
    const result = CustomNodeSchema.safeParse({ ...defaultData(), values: { notes: "", price: 10 } });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join(".") === "values.price")).toBe(true);
  });
});
