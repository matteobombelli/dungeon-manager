// Node type ids live apart from the registry so schemas that reference every type (graph, group)
// can import them without a module cycle through the type definitions themselves.
export const NODE_TYPE_IDS = ["custom", "map", "statblock", "character", "event", "music", "group"] as const;
export type NodeTypeId = (typeof NODE_TYPE_IDS)[number];

/** Types a group may contain: everything but another group. */
export const GROUP_CHILD_TYPE_IDS = ["custom", "map", "statblock", "character", "event", "music"] as const;
export type GroupChildTypeId = (typeof GROUP_CHILD_TYPE_IDS)[number];

export function isNodeTypeId(s: string): s is NodeTypeId {
  return (NODE_TYPE_IDS as readonly string[]).includes(s);
}
