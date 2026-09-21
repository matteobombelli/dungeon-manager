/** Straight-line routing around rectangular obstacles, for the arrows between scene cards. */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Sides clockwise; corner k sits between side k and side k + 1. */
const TOP = 0;
const RIGHT = 1;
const BOTTOM = 2;
const LEFT = 3;

function corner(r: Rect, k: number): Point {
  switch ((k + 4) % 4) {
    case 0:
      return { x: r.right, y: r.top };
    case 1:
      return { x: r.right, y: r.bottom };
    case 2:
      return { x: r.left, y: r.bottom };
    default:
      return { x: r.left, y: r.top };
  }
}

interface Crossing {
  tIn: number;
  sideIn: number;
  sideOut: number;
}

/** Liang–Barsky: where the segment a→b passes through `r`; null when it misses, only touches, or ends inside. */
export function crossing(a: Point, b: Point, r: Rect): Crossing | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - r.left, r.right - a.x, a.y - r.top, r.bottom - a.y];
  const sides = [LEFT, RIGHT, TOP, BOTTOM];
  let t0 = 0;
  let t1 = 1;
  let sideIn = -1;
  let sideOut = -1;
  for (let k = 0; k < 4; k++) {
    if (p[k] === 0) {
      if (q[k] <= 0) return null;
      continue;
    }
    const t = q[k] / p[k];
    if (p[k] < 0) {
      if (t > t1) return null;
      if (t > t0) {
        t0 = t;
        sideIn = sides[k];
      }
    } else {
      if (t < t0) return null;
      if (t < t1) {
        t1 = t;
        sideOut = sides[k];
      }
    }
  }
  if (sideIn < 0 || sideOut < 0 || t0 >= t1 || sideIn === sideOut) return null;
  return { tIn: t0, sideIn, sideOut };
}

function length(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** The shorter of the two corner sequences that lead around `r` from its entry side to its exit side. */
function detour(a: Point, b: Point, r: Rect, { sideIn, sideOut }: Crossing): Point[] {
  const clockwise: Point[] = [];
  for (let k = sideIn; k !== sideOut; k = (k + 1) % 4) clockwise.push(corner(r, k));
  const counter: Point[] = [];
  for (let k = sideIn; k !== sideOut; k = (k + 3) % 4) counter.push(corner(r, k - 1));
  return length([a, ...clockwise, b]) <= length([a, ...counter, b]) ? clockwise : counter;
}

const MAX_DEPTH = 3;

/**
 * Waypoints that take the segment a→b around every obstacle it would cross. Each detour hugs an
 * obstacle's border, so the obstacles should already include whatever clearance the arrow needs.
 */
export function routeAround(a: Point, b: Point, obstacles: Rect[], depth = MAX_DEPTH): Point[] {
  if (depth === 0) return [];
  let hit: { rect: Rect; crossing: Crossing } | null = null;
  for (const rect of obstacles) {
    const c = crossing(a, b, rect);
    if (c && (!hit || c.tIn < hit.crossing.tIn)) hit = { rect, crossing: c };
  }
  if (!hit) return [];
  const rest = obstacles.filter((r) => r !== hit.rect);
  const points = [a, ...detour(a, b, hit.rect, hit.crossing), b];
  const out: Point[] = [];
  for (let i = 1; i < points.length; i++) {
    out.push(...routeAround(points[i - 1], points[i], rest, depth - 1));
    if (i < points.length - 1) out.push(points[i]);
  }
  return out;
}

/** The point half way along the polyline. */
export function midpoint(points: Point[]): Point {
  let remaining = length(points) / 2;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (seg >= remaining) {
      const t = seg === 0 ? 0 : remaining / seg;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
    }
    remaining -= seg;
  }
  return points[points.length - 1];
}

/** SVG path through `points`, with each bend rounded off by up to `radius`. */
export function roundedPath(points: Point[], radius: number): string {
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const p = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y);
    const outLen = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r === 0) {
      d.push(`L ${p.x} ${p.y}`);
      continue;
    }
    const from = { x: p.x - ((p.x - prev.x) / inLen) * r, y: p.y - ((p.y - prev.y) / inLen) * r };
    const to = { x: p.x + ((next.x - p.x) / outLen) * r, y: p.y + ((next.y - p.y) / outLen) * r };
    d.push(`L ${from.x} ${from.y}`, `Q ${p.x} ${p.y} ${to.x} ${to.y}`);
  }
  const last = points[points.length - 1];
  d.push(`L ${last.x} ${last.y}`);
  return d.join(" ");
}
