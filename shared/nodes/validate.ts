import type { z } from "zod";
import { NODE_TYPES } from "./registry";
import type { NodeTypeId } from "./ids";

/** Validates one node's data against its type's schema, reporting issues under `path`. */
export function validateNodeData(type: NodeTypeId, data: unknown, ctx: z.RefinementCtx, path: PropertyKey[]): void {
  // NODE_TYPES is read at call time, never at module load, so the import cycle through the registry is harmless.
  const result = NODE_TYPES[type].schema.safeParse(data);
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({ code: "custom", path: [...path, ...issue.path], message: issue.message });
  }
}
