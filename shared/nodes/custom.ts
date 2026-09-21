import { z } from "zod";
import { CustomFieldsSchema, type CustomFieldKind } from "./custom-fields";
import type { NodeTypeDef } from "./registry";

const valueMatchesKind: Record<CustomFieldKind, (v: unknown) => boolean> = {
  text: (v) => typeof v === "string",
  number: (v) => v === null || typeof v === "number",
  image: (v) => v === null || typeof v === "string",
};

export const CustomNodeSchema = z
  .object({
    fields: CustomFieldsSchema,
    values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  })
  .superRefine((data, ctx) => {
    const kinds = new Map(data.fields.map((f) => [f.key, f.kind]));
    for (const [key, value] of Object.entries(data.values)) {
      const kind = kinds.get(key);
      if (kind === undefined) {
        ctx.addIssue({ code: "custom", path: ["values", key], message: "No field with this key" });
      } else if (!valueMatchesKind[kind](value)) {
        ctx.addIssue({ code: "custom", path: ["values", key], message: `Value does not match ${kind} field` });
      }
    }
  });
export type CustomNodeData = z.infer<typeof CustomNodeSchema>;

export function defaultData(): CustomNodeData {
  return {
    fields: [{ key: "notes", label: "Notes", kind: "text" }],
    values: { notes: "" },
  };
}

export function titleOf(data: CustomNodeData): string {
  const first = data.fields.find((f) => f.kind === "text");
  const value = first ? data.values[first.key] : undefined;
  return typeof value === "string" && value.trim() !== "" ? value : "Custom";
}

export const customType: NodeTypeDef<CustomNodeData> = {
  id: "custom",
  label: "Custom",
  schema: CustomNodeSchema,
  defaultData,
  titleOf,
};
