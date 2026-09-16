import { z } from "zod";
import { AbilitySchema, SkillSchema } from "./statblock";
import type { NodeTypeDef } from "./registry";

// "save" is a saving throw on `ability`; null is a plain ability check.
export const EventCheckSkillSchema = z.union([SkillSchema, z.literal("save")]).nullable();
export type EventCheckSkill = z.infer<typeof EventCheckSkillSchema>;

export const EventCheckSchema = z.object({
  id: z.string().min(1),
  ability: AbilitySchema,
  skill: EventCheckSkillSchema,
  dc: z.int().min(1).max(40),
  successText: z.string(),
  failureText: z.string(),
});
export type EventCheck = z.infer<typeof EventCheckSchema>;

export const EVENT_SECTIONS = ["description", "checks"] as const;
export type EventSection = (typeof EVENT_SECTIONS)[number];
export const EVENT_SECTION_LABELS: Record<EventSection, string> = { description: "Description", checks: "Checks" };

export const EventSchema = z.object({
  title: z.string(),
  description: z.string(),
  checks: z.array(EventCheckSchema).max(20),
  // Editor sections the user removed; absent means all shown. Data behind a hidden section is kept.
  hiddenSections: z.array(z.enum(EVENT_SECTIONS)).optional(),
});
export type EventData = z.infer<typeof EventSchema>;

export function defaultData(): EventData {
  return { title: "", description: "", checks: [] };
}

export function titleOf(data: EventData): string {
  return data.title || "Event";
}

export const eventType: NodeTypeDef<EventData> = {
  id: "event",
  label: "Event",
  schema: EventSchema,
  defaultData,
  titleOf,
};
