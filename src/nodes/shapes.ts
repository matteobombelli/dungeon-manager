import type { NodeTypeId } from "../../shared/nodes/registry";

export type NodeShape = "rect" | "square" | "circle" | "hexagon" | "pill" | "diamond" | "octagon" | "frame";

export const NODE_SHAPES: Record<NodeTypeId, NodeShape> = {
  map: "square",
  event: "circle",
  statblock: "hexagon",
  character: "pill",
  custom: "diamond",
  music: "octagon",
  group: "frame",
};

/** Each shape's CSS box (nodes.css); nothing stores a size, so miniatures assume these. */
export const SHAPE_SIZES: Record<NodeShape, { w: number; h: number }> = {
  rect: { w: 200, h: 80 },
  square: { w: 180, h: 180 },
  circle: { w: 180, h: 180 },
  pill: { w: 150, h: 210 },
  hexagon: { w: 200, h: 174 },
  diamond: { w: 210, h: 180 },
  octagon: { w: 190, h: 190 },
  frame: { w: 200, h: 146 },
};

/** Corner fractions of the clipped shapes; they mirror the --clip polygons in nodes.css and change together. */
export const SHAPE_POLYGONS: Partial<Record<NodeShape, [number, number][]>> = {
  hexagon: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  octagon: [[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3]],
};
