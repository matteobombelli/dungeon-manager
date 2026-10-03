import { describe, expect, it } from "vitest";
import { defaultData, type MapNodeData } from "../../shared/nodes/map";
import { brushRectAt, cellIndicesAt } from "../../src/map-editor/hitTest";
import { floodFill } from "../../src/map-editor/mapOps";

function grid(rows: string[]): MapNodeData {
  return {
    ...defaultData(),
    cols: rows[0].length,
    rows: rows.length,
    cellSize: 10,
    cells: rows.flatMap((r) => [...r].map(Number)),
  };
}

describe("floodFill", () => {
  it("fills the 4-connected region of the start value only", () => {
    const data = grid(["001", "010", "100"]);
    expect(floodFill(data, 0, 2)).toEqual([2, 2, 1, 2, 1, 0, 1, 0, 0]);
  });

  it("does not wrap across row ends", () => {
    const data = grid(["01", "10"]);
    expect(floodFill(data, 1, 3)).toEqual([0, 3, 1, 0]);
  });

  it("returns null when nothing would change or start is out of range", () => {
    const data = grid(["11", "11"]);
    expect(floodFill(data, 0, 1)).toBeNull();
    expect(floodFill(data, -1, 2)).toBeNull();
  });
});

describe("brushRectAt", () => {
  const data = grid(["00000", "00000", "00000", "00000", "00000"]);

  it("centres the block on the cell under the point", () => {
    expect(brushRectAt(data, 25, 25, 3)).toEqual({ col: 1, row: 1, cols: 3, rows: 3 });
    expect(cellIndicesAt(data, 25, 25, 1)).toEqual([12]);
  });

  it("clips at the grid edges", () => {
    expect(brushRectAt(data, 5, 5, 3)).toEqual({ col: 0, row: 0, cols: 2, rows: 2 });
    expect(cellIndicesAt(data, 5, 5, 3)).toEqual([0, 1, 5, 6]);
  });

  it("is null outside the grid", () => {
    expect(brushRectAt(data, 60, 5, 3)).toBeNull();
    expect(cellIndicesAt(data, 60, 5, 3)).toEqual([]);
  });
});
