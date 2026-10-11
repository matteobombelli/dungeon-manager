import { describe, expect, it } from "vitest";
import { defaultData, type MapNodeData } from "../../shared/nodes/map";
import { brushRectAt, cellIndicesAt } from "../../src/map-editor/hitTest";
import { floodFill, scaleStrokes, strokesWithin } from "../../src/map-editor/mapOps";

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
  });

  it("is null for size 0, the pen tools' no-brush size", () => {
    const data = grid(["000", "000", "000"]);
    expect(brushRectAt(data, 15, 15, 0)).toBeNull();
    expect(cellIndicesAt(data, 15, 15, 0)).toEqual([]);
    expect(cellIndicesAt(data, 60, 5, 3)).toEqual([]);
  });
});

describe("scaleStrokes", () => {
  it("scales points and width with the cell size", () => {
    const strokes = [{ color: "#000000", width: 4, points: [10, 20, 33.3, 40] }];
    expect(scaleStrokes(strokes, 0.5)).toEqual([{ color: "#000000", width: 2, points: [5, 10, 16.7, 20] }]);
  });

  it("keeps the width inside the schema's bounds", () => {
    const strokes = [
      { color: "#000000", width: 1, points: [0, 0, 1, 1] },
      { color: "#000000", width: 30, points: [0, 0, 1, 1] },
    ];
    expect(scaleStrokes(strokes, 0.25).map((s) => s.width)).toEqual([1, 7.5]);
    expect(scaleStrokes(strokes, 8).map((s) => s.width)).toEqual([8, 32]);
  });

  it("returns the same array for factor 1", () => {
    const strokes = [{ color: "#000000", width: 4, points: [0, 0, 1, 1] }];
    expect(scaleStrokes(strokes, 1)).toBe(strokes);
  });
});

describe("strokesWithin", () => {
  it("drops only strokes entirely outside the map", () => {
    const inside = { color: "#000000", width: 2, points: [10, 10, 20, 20] };
    const straddling = { color: "#000000", width: 2, points: [90, 10, 150, 10] };
    const outside = { color: "#000000", width: 2, points: [120, 10, 150, 10] };
    const below = { color: "#000000", width: 2, points: [10, 130, 20, 140] };
    expect(strokesWithin([inside, straddling, outside, below], 100, 100)).toEqual([inside, straddling]);
  });
});
