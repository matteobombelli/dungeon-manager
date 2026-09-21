import type { NodeOutline } from "../../shared/graph";
import { NODE_SHAPES, SHAPE_SIZES } from "./shapes";

export interface PreviewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PADDING = 40;
// The box never shrinks below this, so a lone node stays a small mark instead of filling the frame.
export const MIN_BOX = { w: 520, h: 272 } as const;

/** The viewBox for a miniature of `nodes`: their bounding box, padded, centred, and at least MIN_BOX. */
export function previewBox(nodes: readonly NodeOutline[]): PreviewBox {
  if (nodes.length === 0) return { x: -MIN_BOX.w / 2, y: -MIN_BOX.h / 2, ...MIN_BOX };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const { w, h } = SHAPE_SIZES[NODE_SHAPES[n.type]];
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  }
  const w = Math.max(maxX - minX + 2 * PADDING, MIN_BOX.w);
  const h = Math.max(maxY - minY + 2 * PADDING, MIN_BOX.h);
  return { x: (minX + maxX - w) / 2, y: (minY + maxY - h) / 2, w, h };
}
