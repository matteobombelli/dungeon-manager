import type { Node } from "@xyflow/react";

/**
 * Sets a node's persisted colour and mirrors it as a CSS variable on React Flow's wrapper div,
 * which is the only way the value reaches the card (NodeProps never carries custom node fields).
 * `.node-card` resolves `--tone: var(--tone-override, var(--tone-default))`.
 */
export function withColor<N extends Node>(node: N, color: string | null): N & { color: string | null } {
  const style = { ...node.style } as Record<string, unknown>;
  if (color) style["--tone-override"] = color;
  else delete style["--tone-override"];
  return { ...node, color, style };
}
