import type { RefObject } from "react";
import { API_PREFIX } from "../../shared/api";
import { CampaignGraphSchema, type CampaignGraph } from "../../shared/campaign-graph";
import { campaigns } from "../api/endpoints";
import { useDocumentAutosave, type SaveStatus } from "../autosave/useDocumentAutosave";
import type { SceneNode } from "./CampaignGraph";
import type { RouteEdge } from "./RouteEdge";

export function toCampaignGraph(nodes: SceneNode[], edges: RouteEdge[]): CampaignGraph {
  return {
    scenes: nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, color: n.data.color })),
    links: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : "",
      color: e.data?.color ?? null,
    })),
  };
}

export function useCampaignAutosave(
  campaignId: string,
  nodes: SceneNode[],
  edges: RouteEdge[],
  holds: RefObject<boolean>[]
): { status: SaveStatus; error: string | null } {
  return useDocumentAutosave<CampaignGraph>({
    key: campaignId,
    inputs: [nodes, edges],
    snapshot: () => toCampaignGraph(nodes, edges),
    schema: CampaignGraphSchema,
    save: (graph) => campaigns.putGraph(campaignId, graph),
    flushUrl: `${API_PREFIX}/campaigns/${campaignId}/graph`,
    holds,
  });
}
