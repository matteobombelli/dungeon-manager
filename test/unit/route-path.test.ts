import { describe, expect, it } from "vitest";
import { crossing, midpoint, roundedPath, routeAround, type Point, type Rect } from "../../src/campaign-graph/route-path";

const box: Rect = { left: 100, top: 100, right: 200, bottom: 200 };

function inside(p: Point, r: Rect): boolean {
  return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
}

/** Sample points along every segment of the polyline. */
function samples(points: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < points.length; i++) {
    for (let t = 0; t <= 1; t += 0.05) {
      out.push({ x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t });
    }
  }
  return out;
}

describe("crossing", () => {
  it("finds the sides a segment enters and leaves through", () => {
    expect(crossing({ x: 0, y: 150 }, { x: 300, y: 150 }, box)).toEqual({ tIn: 100 / 300, sideIn: 3, sideOut: 1 });
    expect(crossing({ x: 150, y: 0 }, { x: 150, y: 300 }, box)).toMatchObject({ sideIn: 0, sideOut: 2 });
  });

  it("ignores a segment that misses, touches, or ends inside the box", () => {
    expect(crossing({ x: 0, y: 50 }, { x: 300, y: 50 }, box)).toBeNull();
    expect(crossing({ x: 0, y: 100 }, { x: 300, y: 100 }, box)).toBeNull();
    expect(crossing({ x: 0, y: 150 }, { x: 150, y: 150 }, box)).toBeNull();
  });
});

describe("routeAround", () => {
  it("adds nothing when the way is clear", () => {
    expect(routeAround({ x: 0, y: 50 }, { x: 300, y: 50 }, [box])).toEqual([]);
  });

  it("goes around the nearest side of a box in the way", () => {
    const a = { x: 0, y: 130 };
    const b = { x: 300, y: 130 };
    const bends = routeAround(a, b, [box]);
    expect(bends).toEqual([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    expect(samples([a, ...bends, b]).some((p) => inside(p, box))).toBe(false);
  });

  it("turns one corner when the segment clips a corner of the box", () => {
    const a = { x: 0, y: 220 };
    const b = { x: 220, y: 0 };
    expect(routeAround(a, b, [box])).toEqual([{ x: 100, y: 100 }]);
  });

  it("keeps clear of several boxes", () => {
    const boxes: Rect[] = [box, { left: 250, top: 50, right: 350, bottom: 150 }];
    const a = { x: 0, y: 130 };
    const b = { x: 500, y: 130 };
    const path = [a, ...routeAround(a, b, boxes), b];
    expect(samples(path).some((p) => boxes.some((r) => inside(p, r)))).toBe(false);
  });
});

describe("midpoint", () => {
  it("is half way along the polyline by length", () => {
    expect(midpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])).toEqual({ x: 100, y: 0 });
  });
});

describe("roundedPath", () => {
  it("draws a straight line as a single segment", () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }], 5)).toBe("M 0 0 L 10 0");
  });

  it("rounds each bend with a quadratic curve through the corner", () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 20)).toBe("M 0 0 L 80 0 Q 100 0 100 20 L 100 100");
  });
});
