import { z } from "zod";
import type { NodeTypeDef } from "./registry";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const AbilitySchema = z.enum(ABILITIES);
export type Ability = z.infer<typeof AbilitySchema>;

export const SKILLS = [
  "acrobatics",
  "animal_handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight_of_hand",
  "stealth",
  "survival",
] as const;
export const SkillSchema = z.enum(SKILLS);
export type Skill = z.infer<typeof SkillSchema>;

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: "dex",
  animal_handling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleight_of_hand: "dex",
  stealth: "dex",
  survival: "wis",
};

export const CHALLENGE_RATINGS = [
  "0", "1/8", "1/4", "1/2",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
] as const;
export const ChallengeRatingSchema = z.enum(CHALLENGE_RATINGS);
export type ChallengeRating = z.infer<typeof ChallengeRatingSchema>;

const CR_XP: Record<ChallengeRating, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
  "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000,
  "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

const Score = z.int().min(1).max(30);

export const FeatureSchema = z.object({ name: z.string(), desc: z.string() });
export type Feature = z.infer<typeof FeatureSchema>;

export const STATBLOCK_SECTIONS = [
  "encounter",
  "identity",
  "defenses",
  "abilities",
  "saves",
  "skills",
  "resistances",
  "challenge",
  "traits",
  "actions",
  "reactions",
  "legendary",
  "description",
] as const;
export type StatblockSection = (typeof STATBLOCK_SECTIONS)[number];
export const STATBLOCK_SECTION_LABELS: Record<StatblockSection, string> = {
  encounter: "Encounter",
  identity: "Identity",
  defenses: "Defenses",
  abilities: "Abilities",
  saves: "Saving throws",
  skills: "Skills",
  resistances: "Resistances and senses",
  challenge: "Challenge",
  traits: "Traits",
  actions: "Actions",
  reactions: "Reactions",
  legendary: "Legendary actions",
  description: "Description",
};

/** The SRD conditions, offered as toggles in the encounter tracker; free text is allowed too. */
export const CONDITIONS = [
  "blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated",
  "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious",
] as const;

// Encounter state. Absent on blocks saved before it existed and treated as "untouched":
// currentHp null means at max, counters null mean at their per-round maximum.
export const TrackerSchema = z.object({
  currentHp: z.int().min(0).nullable(),
  tempHp: z.int().min(0),
  conditions: z.array(z.string().max(60)).max(40),
  concentrating: z.boolean(),
  legendaryActionsLeft: z.int().min(0).nullable(),
  legendaryResistancesLeft: z.int().min(0).nullable(),
});
export type Tracker = z.infer<typeof TrackerSchema>;

export function defaultTracker(): Tracker {
  return { currentHp: null, tempHp: 0, conditions: [], concentrating: false, legendaryActionsLeft: null, legendaryResistancesLeft: null };
}

export const StatblockSchema = z.object({
  name: z.string(),
  size: z.string(),
  type: z.string(),
  subtype: z.string(),
  alignment: z.string(),
  armorClass: z.object({ value: z.int().min(0), description: z.string() }),
  hitPoints: z.object({ average: z.int().min(0), hitDice: z.string() }),
  speed: z.record(z.string(), z.string()),
  abilities: z.object({ str: Score, dex: Score, con: Score, int: Score, wis: Score, cha: Score }),
  savingThrows: z.partialRecord(AbilitySchema, z.int()),
  skills: z.partialRecord(SkillSchema, z.int()),
  damageVulnerabilities: z.array(z.string()),
  damageResistances: z.array(z.string()),
  damageImmunities: z.array(z.string()),
  conditionImmunities: z.array(z.string()),
  senses: z.string(),
  languages: z.string(),
  challengeRating: ChallengeRatingSchema,
  xp: z.int().min(0),
  traits: z.array(FeatureSchema),
  actions: z.array(FeatureSchema),
  reactions: z.array(FeatureSchema),
  legendaryActions: z.array(FeatureSchema),
  legendaryDescription: z.string(),
  // Optional, not defaulted: stored rows are never re-parsed on read, so the editor supplies the defaults (3 and 0).
  legendaryActionsPerRound: z.int().min(0).optional(),
  legendaryResistances: z.int().min(0).optional(),
  description: z.string(),
  tracker: TrackerSchema.optional(),
  // Editor sections the user removed; absent means all shown. Data behind a hidden section is kept.
  hiddenSections: z.array(z.enum(STATBLOCK_SECTIONS)).optional(),
});
export type StatblockData = z.infer<typeof StatblockSchema>;

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function crToNumber(cr: string): number {
  const [num, den] = cr.split("/");
  return den === undefined ? Number(num) : Number(num) / Number(den);
}

export function formatCR(n: number): string {
  if (n === 0.125) return "1/8";
  if (n === 0.25) return "1/4";
  if (n === 0.5) return "1/2";
  return String(n);
}

export function proficiencyBonusForCR(cr: string): number {
  return 2 + Math.floor((Math.max(crToNumber(cr), 1) - 1) / 4);
}

export function xpForCR(cr: string): number {
  return (CR_XP as Record<string, number>)[cr] ?? 0;
}

export function passivePerception(d: StatblockData): number {
  return 10 + (d.skills.perception ?? abilityModifier(d.abilities.wis));
}

export function defaultData(): StatblockData {
  return {
    name: "",
    size: "Medium",
    type: "humanoid",
    subtype: "",
    alignment: "unaligned",
    armorClass: { value: 10, description: "" },
    hitPoints: { average: 4, hitDice: "1d8" },
    speed: { walk: "30 ft." },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: {},
    skills: {},
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    senses: "passive Perception 10",
    languages: "Common",
    challengeRating: "0",
    xp: xpForCR("0"),
    traits: [],
    actions: [],
    reactions: [],
    legendaryActions: [],
    legendaryDescription: "",
    description: "",
  };
}

export function titleOf(data: StatblockData): string {
  return data.name || "Stat Block";
}

export const statblockType: NodeTypeDef<StatblockData> = {
  id: "statblock",
  label: "Stat Block",
  schema: StatblockSchema,
  defaultData,
  titleOf,
};
