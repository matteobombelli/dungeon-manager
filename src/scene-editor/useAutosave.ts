import type { RefObject } from "react";
import { API_PREFIX } from "../../shared/api";
import { GraphSchema, type Graph, type GraphNode } from "../../shared/graph";
import { scenes } from "../api/endpoints";
import { useDocumentAutosave, type SaveStatus } from "../autosave/useDocumentAutosave";
import type { AppNode } from "../nodes/registry";

export type { SaveStatus };

export function fromGraph(nodes: readonly GraphNode[]): AppNode[] {
  return nodes.map((n) => ({ id: n.id, type: n.type, position: { x: n.x, y: n.y }, data: n.data as Record<string, unknown> }));
}

export function toGraph(nodes: AppNode[]): Graph {
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, x: n.position.x, y: n.position.y, data: n.data })),
  };
}

export function useAutosave(
  sceneId: string,
  nodes: AppNode[],
  /** Reads the newest nodes, including a canvas's last report, which arrives after the final render. */
  getNodes: () => AppNode[],
  holds: RefObject<boolean>[]
): { status: SaveStatus; error: string | null } {
  return useDocumentAutosave<Graph>({
    key: sceneId,
    inputs: [nodes],
    snapshot: () => toGraph(getNodes()),
    schema: GraphSchema,
    save: (graph) => scenes.putGraph(sceneId, graph),
    flushUrl: `${API_PREFIX}/scenes/${sceneId}/graph`,
    holds,
  });
}
