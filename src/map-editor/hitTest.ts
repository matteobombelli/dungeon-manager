import type { MapNodeData, MapStroke } from "../../shared/nodes/map";

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Index of the topmost stroke whose path passes within `width / 2 + tolerance` of (x, y),
 * all in map pixels; -1 when none.
 */
export function strokeIndexAt(strokes: MapStroke[], x: number, y: number, tolerance: number): number {
  for (let s = strokes.length - 1; s >= 0; s--) {
    const { points, width } = strokes[s];
    const limit = width / 2 + tolerance;
    if (points.length === 2) {
      if (Math.hypot(x - points[0], y - points[1]) <= limit) return s;
      continue;
    }
    for (let i = 0; i + 3 < points.length; i += 2) {
      if (distanceToSegment(x, y, points[i], points[i + 1], points[i + 2], points[i + 3]) <= limit) return s;
    }
  }
  return -1;
}

/** Flat cell index under (x, y) in map pixels; -1 when outside the grid. */
export function cellIndexAt(data: MapNodeData, x: number, y: number): number {
  const col = Math.floor(x / data.cellSize);
  const row = Math.floor(y / data.cellSize);
  if (col < 0 || row < 0 || col >= data.cols || row >= data.rows) return -1;
  return row * data.cols + col;
}
