import { z } from "zod";
import type { NodeTypeDef } from "./registry";

export const CHARACTER_SECTIONS = ["portrait", "details", "player", "description", "notes"] as const;
export type CharacterSection = (typeof CHARACTER_SECTIONS)[number];
export const CHARACTER_SECTION_LABELS: Record<CharacterSection, string> = {
  portrait: "Portrait",
  details: "Race, class and level",
  player: "Player character",
  description: "Description",
  notes: "Notes",
};

export const CharacterSchema = z.object({
  name: z.string(),
  portraitAssetId: z.string().nullable(),
  race: z.string(),
  class: z.string(),
  level: z.int().min(1).max(20),
  isPlayer: z.boolean(),
  description: z.string(),
  notes: z.string(),
  // Editor sections the user removed; absent means all shown. Data behind a hidden section is kept.
  hiddenSections: z.array(z.enum(CHARACTER_SECTIONS)).optional(),
});
export type CharacterData = z.infer<typeof CharacterSchema>;

export function defaultData(): CharacterData {
  return {
    name: "",
    portraitAssetId: null,
    race: "",
    class: "",
    level: 1,
    isPlayer: false,
    description: "",
    notes: "",
  };
}

export function titleOf(data: CharacterData): string {
  return data.name || "Character";
}

export const characterType: NodeTypeDef<CharacterData> = {
  id: "character",
  label: "Character",
  schema: CharacterSchema,
  defaultData,
  titleOf,
};
