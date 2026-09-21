import { describe, expect, it } from "vitest";
import type { NodeOutline } from "../../shared/graph";
import { MIN_BOX, previewBox } from "../../src/nodes/preview-box";
import { SHAPE_SIZES } from "../../src/nodes/shapes";

function outline(id: string, type: NodeOutline["type"], x: number, y: number): NodeOutline {
  return { id, type, x, y, color: null };
}

describe("previewBox", () => {
  it("is the minimum box around the origin when there are no nodes", () => {
    expect(previewBox([])).toEqual({ x: -MIN_BOX.w / 2, y: -MIN_BOX.h / 2, w: MIN_BOX.w, h: MIN_BOX.h });
  });

  it("centres a lone node in the minimum box", () => {
    const { w, h } = SHAPE_SIZES.square;
    const box = previewBox([outline("a", "map", 100, 50)]);
    expect(box.w).toBe(MIN_BOX.w);
    expect(box.h).toBe(MIN_BOX.h);
    expect(box.x + box.w / 2).toBe(100 + w / 2);
    expect(box.y + box.h / 2).toBe(50 + h / 2);
  });

  it("grows to fit spread-out nodes with padding", () => {
    const event = SHAPE_SIZES.circle;
    const box = previewBox([outline("a", "map", 0, 0), outline("b", "event", 1000, 800)]);
    expect(box).toEqual({ x: -40, y: -40, w: 1000 + event.w + 80, h: 800 + event.h + 80 });
  });
});
