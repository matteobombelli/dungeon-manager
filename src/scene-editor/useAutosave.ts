import type { RefObject } from "react";
import type { Edge } from "@xyflow/react";
import { API_PREFIX } from "../../shared/api";
import { GraphSchema, type Graph } from "../../shared/graph";
import { scenes } from "../api/endpoints";
import { useDocumentAutosave, type SaveStatus } from "../autosave/useDocumentAutosave";
import type { AppNode } from "../nodes/registry";

export type { SaveStatus };

export function toGraph(nodes: AppNode[], edges: Edge[]): Graph {
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, x: n.position.x, y: n.position.y, color: n.color, data: n.data })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : "",
    })),
  };
}

export function useAutosave(
  sceneId: string,
  nodes: AppNode[],
  edges: Edge[],
  holds: RefObject<boolean>[]
): { status: SaveStatus; error: string | null } {
  return useDocumentAutosave<Graph>({
    key: sceneId,
    inputs: [nodes, edges],
    snapshot: () => toGraph(nodes, edges),
    schema: GraphSchema,
    save: (graph) => scenes.putGraph(sceneId, graph),
    flushUrl: `${API_PREFIX}/scenes/${sceneId}/graph`,
    holds,
  });
}
