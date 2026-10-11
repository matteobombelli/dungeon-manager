import type { z } from "zod";
import { NODE_TYPES } from "./registry";
import type { NodeTypeId } from "./ids";

/**
 * Parses one node's data against its type's schema and returns the parsed value (unknown keys
 * stripped, defaults filled), or reports issues under `path` and returns undefined.
 */
export function parseNodeData(
  type: NodeTypeId,
  data: unknown,
  ctx: z.RefinementCtx,
  path: PropertyKey[],
): unknown {
  // NODE_TYPES is read at call time, never at module load, so the import cycle through the registry is harmless.
  const result = NODE_TYPES[type].schema.safeParse(data);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    ctx.addIssue({ code: "custom", path: [...path, ...issue.path], message: issue.message });
  }
  return undefined;
}
