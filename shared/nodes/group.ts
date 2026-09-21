import { z } from "zod";
import { NodeColorSchema } from "../color";
import { GROUP_CHILD_TYPE_IDS } from "./ids";
import type { NodeTypeDef } from "./registry";
import { validateNodeData } from "./validate";

export const GROUP_LIMITS = { maxNodes: 200, maxName: 120 } as const;

// Same shape as a scene-level GraphNode, minus the group type: groups do not nest.
export const GroupChildSchema = z.object({
  id: z.string().min(1),
  type: z.enum(GROUP_CHILD_TYPE_IDS),
  x: z.number(),
  y: z.number(),
  color: NodeColorSchema.default(null),
  data: z.unknown(),
});
export type GroupChild = z.infer<typeof GroupChildSchema>;

export const GroupSchema = z
  .object({
    name: z.string().max(GROUP_LIMITS.maxName),
    nodes: z.array(GroupChildSchema).max(GROUP_LIMITS.maxNodes),
  })
  .superRefine((group, ctx) => {
    const ids = new Set<string>();
    group.nodes.forEach((node, i) => {
      if (ids.has(node.id)) ctx.addIssue({ code: "custom", path: ["nodes", i, "id"], message: "Duplicate node id" });
      ids.add(node.id);
      validateNodeData(node.type, node.data, ctx, ["nodes", i, "data"]);
    });
  });
export type GroupData = z.infer<typeof GroupSchema>;

export function defaultData(): GroupData {
  return { name: "", nodes: [] };
}

export function titleOf(data: GroupData): string {
  return data.name || "Group";
}

export const groupType: NodeTypeDef<GroupData> = {
  id: "group",
  label: "Group",
  schema: GroupSchema,
  defaultData,
  titleOf,
};
