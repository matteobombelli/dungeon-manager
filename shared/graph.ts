import { z } from "zod";
import { NodeColorSchema } from "./color";
import { NODE_TYPES, NODE_TYPE_IDS } from "./nodes/registry";

export const GRAPH_LIMITS = { maxNodes: 500, maxEdges: 1000, maxLabel: 200 } as const;

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(NODE_TYPE_IDS),
  x: z.number(),
  y: z.number(),
  color: NodeColorSchema.default(null),
  data: z.unknown(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().max(GRAPH_LIMITS.maxLabel),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

// Scene edges are undirected, so each pair is stored once with source <= target.
export function canonicalEdge<E extends { source: string; target: string }>(e: E): E {
  return e.source <= e.target ? e : { ...e, source: e.target, target: e.source };
}

/** Canonicalises edges and drops self-loops and later duplicates of a pair. */
export function normaliseEdges<E extends { source: string; target: string }>(edges: E[]): E[] {
  const seen = new Set<string>();
  const out: E[] = [];
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const canonical = canonicalEdge(edge);
    const pair = JSON.stringify([canonical.source, canonical.target]);
    if (seen.has(pair)) continue;
    seen.add(pair);
    out.push(canonical);
  }
  return out;
}

export const GraphSchema = z
  .object({
    nodes: z.array(GraphNodeSchema).max(GRAPH_LIMITS.maxNodes),
    edges: z.array(GraphEdgeSchema).max(GRAPH_LIMITS.maxEdges),
  })
  .superRefine((graph, ctx) => {
    const nodeIds = new Set<string>();
    graph.nodes.forEach((node, i) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({ code: "custom", path: ["nodes", i, "id"], message: "Duplicate node id" });
      }
      nodeIds.add(node.id);
      const result = NODE_TYPES[node.type].schema.safeParse(node.data);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ code: "custom", path: ["nodes", i, "data", ...issue.path], message: issue.message });
        }
      }
    });
    const edgeIds = new Set<string>();
    const pairs = new Set<string>();
    graph.edges.forEach((edge, i) => {
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({ code: "custom", path: ["edges", i, "id"], message: "Duplicate edge id" });
      }
      edgeIds.add(edge.id);
      if (!nodeIds.has(edge.source)) {
        ctx.addIssue({ code: "custom", path: ["edges", i, "source"], message: "Unknown source node" });
      }
      if (!nodeIds.has(edge.target)) {
        ctx.addIssue({ code: "custom", path: ["edges", i, "target"], message: "Unknown target node" });
      }
      if (edge.source === edge.target) {
        ctx.addIssue({ code: "custom", path: ["edges", i], message: "Self-loop" });
      }
      const canonical = canonicalEdge(edge);
      const pair = JSON.stringify([canonical.source, canonical.target]);
      if (pairs.has(pair)) {
        ctx.addIssue({ code: "custom", path: ["edges", i], message: "Duplicate edge" });
      }
      pairs.add(pair);
    });
  })
  .transform((g) => ({ ...g, edges: g.edges.map(canonicalEdge) }));
export type Graph = z.infer<typeof GraphSchema>;
