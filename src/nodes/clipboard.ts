import type { GraphNode } from "../../shared/graph";
import { newId } from "../../shared/ids";
import type { GroupData } from "../../shared/nodes/group";

/** A copied node, positioned relative to the copied selection's top-left corner. */
export interface ClipNode {
  type: GraphNode["type"];
  data: unknown;
  color: string | null;
  dx: number;
  dy: number;
}

// One clipboard for the whole app, so nodes move between scenes and groups within a session.
let clipboard: ClipNode[] = [];

export function copyNodes(nodes: GraphNode[]): void {
  if (nodes.length === 0) return;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  clipboard = nodes.map((n) => ({ type: n.type, data: n.data, color: n.color, dx: n.x - minX, dy: n.y - minY }));
}

/** Fresh copies at `origin`; every id (including a group's children) is new. */
export function pasteNodes(origin: { x: number; y: number }, allowGroups: boolean): GraphNode[] {
  return withFreshIds(
    clipboard
      .filter((n) => allowGroups || n.type !== "group")
      .map((n) => ({ type: n.type, x: origin.x + n.dx, y: origin.y + n.dy, color: n.color, data: n.data }))
  );
}

/** Copies of `nodes` under new ids, including a group's children. */
export function withFreshIds(nodes: Omit<GraphNode, "id">[]): GraphNode[] {
  return nodes.map((n) => ({
    id: newId(),
    type: n.type,
    x: n.x,
    y: n.y,
    color: n.color,
    data: n.type === "group" ? withFreshChildIds(n.data as GroupData) : structuredClone(n.data),
  }));
}

function withFreshChildIds(group: GroupData): GroupData {
  return { ...group, nodes: group.nodes.map((c) => ({ ...structuredClone(c), id: newId() })) };
}
