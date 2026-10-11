import { MAP_LIMITS, type MapNodeData, type MapStroke } from "../../shared/nodes/map";

/** New flat cell array for cols x rows keeping cells that overlap the old grid. */
export function resizeCells(data: MapNodeData, cols: number, rows: number): number[] {
  const next = new Array<number>(cols * rows).fill(0);
  const copyCols = Math.min(cols, data.cols);
  const copyRows = Math.min(rows, data.rows);
  for (let y = 0; y < copyRows; y++) {
    for (let x = 0; x < copyCols; x++) {
      next[y * cols + x] = data.cells[y * data.cols + x] ?? 0;
    }
  }
  return next;
}

/**
 * Strokes are stored in map pixels, so a new cell size scales them with the grid (and the stretched
 * background) rather than leaving them where the old cells were. Points keep toMap's 0.1 px precision.
 */
export function scaleStrokes(strokes: MapStroke[], factor: number): MapStroke[] {
  if (factor === 1) return strokes;
  return strokes.map((s) => ({
    ...s,
    width: Math.min(MAP_LIMITS.maxStrokeWidth, Math.max(1, Math.round(s.width * factor * 10) / 10)),
    points: s.points.map((p) => Math.round(p * factor * 10) / 10),
  }));
}

/**
 * Drops the strokes a smaller map leaves entirely outside it: they could no longer be seen or erased,
 * yet would still count towards the point limit. A stroke that is partly inside stays whole.
 */
export function strokesWithin(strokes: MapStroke[], width: number, height: number): MapStroke[] {
  return strokes.filter((s) => {
    const r = s.width / 2;
    let minX = Infinity;
    let minY = Infinity;
    for (let i = 0; i < s.points.length; i += 2) {
      minX = Math.min(minX, s.points[i]);
      minY = Math.min(minY, s.points[i + 1]);
    }
    return minX - r < width && minY - r < height;
  });
}

/** Removes palette[index]; cells using it become empty, higher palette references shift down by one. */
export function removePaletteEntry(data: MapNodeData, index: number): MapNodeData {
  if (index < 0 || index >= data.palette.length) return data;
  const removedValue = index + 1;
  return {
    ...data,
    palette: data.palette.filter((_, i) => i !== index),
    cells: data.cells.map((c) => (c === removedValue ? 0 : c > removedValue ? c - 1 : c)),
  };
}

/**
 * Cells after flood-filling the 4-connected region of same-valued cells around `start` with `value`;
 * null when start is out of range or already holds `value`.
 */
export function floodFill(data: MapNodeData, start: number, value: number): number[] | null {
  const target = data.cells[start];
  if (target === undefined || target === value) return null;
  const cells = data.cells.slice();
  const stack = [start];
  cells[start] = value;
  while (stack.length > 0) {
    const i = stack.pop()!;
    const col = i % data.cols;
    const neighbours = [
      col > 0 ? i - 1 : -1,
      col < data.cols - 1 ? i + 1 : -1,
      i - data.cols,
      i + data.cols,
    ];
    for (const n of neighbours) {
      if (n < 0 || n >= cells.length || cells[n] !== target) continue;
      cells[n] = value;
      stack.push(n);
    }
  }
  return cells;
}
