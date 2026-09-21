import { describe, expect, it } from "vitest";
import { GROUP_LIMITS, GroupSchema, defaultData, type GroupChild } from "../../shared/nodes/group";
import { NODE_TYPES } from "../../shared/nodes/registry";

function child(id: string, type: GroupChild["type"] = "character"): GroupChild {
  return { id, type, x: 0, y: 0, color: null, data: NODE_TYPES[type].defaultData() };
}

describe("GroupSchema", () => {
  it("accepts the default group", () => {
    const result = GroupSchema.safeParse(defaultData());
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "", nodes: [] });
  });

  it("accepts a character child and a stat block child", () => {
    const nodes = [child("a", "character"), child("b", "statblock")];
    const result = GroupSchema.safeParse({ name: "Ambush", nodes });
    expect(result.success).toBe(true);
    expect(result.data?.nodes.map((n) => n.type)).toEqual(["character", "statblock"]);
  });

  it("rejects a child whose data does not match its type", () => {
    const bad = { ...child("a"), data: { ...NODE_TYPES.character.defaultData(), level: 99 } };
    const result = GroupSchema.safeParse({ name: "", nodes: [bad] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.slice(0, 3).join(".") === "nodes.0.data")).toBe(true);
  });

  it("rejects a nested group", () => {
    const nested = { id: "a", type: "group", x: 0, y: 0, color: null, data: defaultData() };
    expect(GroupSchema.safeParse({ name: "", nodes: [nested] }).success).toBe(false);
  });

  it("rejects duplicate child ids", () => {
    const result = GroupSchema.safeParse({ name: "", nodes: [child("a"), child("a", "event")] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Duplicate node id")).toBe(true);
  });

  it("accepts the child limit but rejects one more", () => {
    const nodes = Array.from({ length: GROUP_LIMITS.maxNodes }, (_, i) => child(`n${i}`, "event"));
    expect(GroupSchema.safeParse({ name: "", nodes }).success).toBe(true);
    expect(GroupSchema.safeParse({ name: "", nodes: [...nodes, child("extra", "event")] }).success).toBe(false);
  });

  it("defaults an omitted child colour to null", () => {
    const { color: _color, ...noColor } = child("a");
    const result = GroupSchema.safeParse({ name: "", nodes: [noColor] });
    expect(result.success).toBe(true);
    expect(result.data?.nodes[0].color).toBeNull();
  });
});
