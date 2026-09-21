import { z } from "zod";
import { NodeColorSchema } from "./color";
import { NODE_TYPE_IDS } from "./nodes/ids";
import { validateNodeData } from "./nodes/validate";

export const GRAPH_LIMITS = { maxNodes: 500 } as const;

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(NODE_TYPE_IDS),
  x: z.number(),
  y: z.number(),
  color: NodeColorSchema.default(null),
  data: z.unknown(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

/** What a card miniature needs of a node; scene-level nodes and group children both satisfy it. */
export type NodeOutline = Pick<GraphNode, "id" | "type" | "x" | "y" | "color">;

// A scene is a set of placed nodes; groups carry their own nodes inside their data.
export const GraphSchema = z
  .object({
    nodes: z.array(GraphNodeSchema).max(GRAPH_LIMITS.maxNodes),
  })
  .superRefine((graph, ctx) => {
    const nodeIds = new Set<string>();
    graph.nodes.forEach((node, i) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({ code: "custom", path: ["nodes", i, "id"], message: "Duplicate node id" });
      }
      nodeIds.add(node.id);
      validateNodeData(node.type, node.data, ctx, ["nodes", i, "data"]);
    });
  });
export type Graph = z.infer<typeof GraphSchema>;
