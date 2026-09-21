import { z } from "zod";

export const CustomFieldKindSchema = z.enum(["text", "number", "image"]);
export type CustomFieldKind = z.infer<typeof CustomFieldKindSchema>;

export const CustomFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().min(1).max(120),
  kind: CustomFieldKindSchema,
});
export type CustomField = z.infer<typeof CustomFieldSchema>;

export const CustomFieldsSchema = z
  .array(CustomFieldSchema)
  .min(1)
  .max(40)
  .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, {
    message: "Field keys must be unique",
  });

/** Derives a legal field key (/^[a-z][a-z0-9_]{0,39}$/) from a human label; may be empty. */
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40);
}
