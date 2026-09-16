import { z } from "zod";

export const PrefabFieldKindSchema = z.enum(["text", "number", "image"]);
export type PrefabFieldKind = z.infer<typeof PrefabFieldKindSchema>;

export const PrefabFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().min(1).max(120),
  kind: PrefabFieldKindSchema,
});
export type PrefabField = z.infer<typeof PrefabFieldSchema>;

export const PrefabFieldsSchema = z
  .array(PrefabFieldSchema)
  .min(1)
  .max(40)
  .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, {
    message: "Field keys must be unique",
  });
export type PrefabFields = z.infer<typeof PrefabFieldsSchema>;

/** Derives a legal field key (/^[a-z][a-z0-9_]{0,39}$/) from a human label; may be empty. */
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40);
}
