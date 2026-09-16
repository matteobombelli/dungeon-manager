import type { NodeTypeId } from "../../shared/nodes/registry";

export type NodeShape = "rect" | "square" | "circle" | "hexagon" | "pill" | "diamond" | "octagon";

export const NODE_SHAPES: Record<NodeTypeId, NodeShape> = {
  map: "square",
  event: "circle",
  statblock: "hexagon",
  character: "pill",
  custom: "diamond",
  music: "octagon",
};
