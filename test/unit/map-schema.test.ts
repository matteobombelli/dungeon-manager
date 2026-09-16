import { describe, expect, it } from "vitest";
import { MAP_LIMITS, MapNodeSchema, defaultData } from "../../shared/nodes/map";

describe("MapNodeSchema", () => {
  it("accepts the default map", () => {
    expect(MapNodeSchema.safeParse(defaultData()).success).toBe(true);
  });

  it("rejects a cells array that does not match cols * rows", () => {
    const data = { ...defaultData(), cells: [0, 0, 0] };
    const result = MapNodeSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "cells.length must equal cols * rows")).toBe(true);
  });

  it("rejects a cell referring past the palette", () => {
    const base = defaultData();
    const cells = [...base.cells];
    cells[5] = base.palette.length + 1;
    expect(MapNodeSchema.safeParse({ ...base, cells }).success).toBe(false);
  });

  it("caps the total number of stroke points", () => {
    const base = defaultData();
    const stroke = (points: number) => ({
      color: "#ff0000",
      width: 2,
      points: new Array<number>(points).fill(0),
    });
    const under = { ...base, strokes: [stroke(MAP_LIMITS.maxTotalPoints)] };
    expect(MapNodeSchema.safeParse(under).success).toBe(true);

    const over = { ...base, strokes: [stroke(MAP_LIMITS.maxTotalPoints), stroke(2)] };
    const result = MapNodeSchema.safeParse(over);
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.message === `Total stroke points must be <= ${MAP_LIMITS.maxTotalPoints}`),
    ).toBe(true);
  });

  it("requires six-digit hex colours", () => {
    const base = defaultData();
    expect(MapNodeSchema.safeParse({ ...base, palette: [{ id: "p", name: "P", color: "#AABBCC" }] }).success).toBe(true);
    expect(MapNodeSchema.safeParse({ ...base, palette: [{ id: "p", name: "P", color: "#abc" }] }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...base, palette: [{ id: "p", name: "P", color: "red" }] }).success).toBe(false);
    expect(
      MapNodeSchema.safeParse({ ...base, strokes: [{ color: "#12345g", width: 1, points: [0, 0] }] }).success,
    ).toBe(false);
  });

  it("rejects out-of-range dimensions", () => {
    const base = defaultData();
    expect(MapNodeSchema.safeParse({ ...base, cols: MAP_LIMITS.maxCols + 1 }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...base, cellSize: MAP_LIMITS.minCellSize - 1 }).success).toBe(false);
  });
});
