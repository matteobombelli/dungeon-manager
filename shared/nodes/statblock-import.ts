import {
  ABILITIES,
  CHALLENGE_RATINGS,
  SKILLS,
  StatblockSchema,
  crToNumber,
  formatCR,
  xpForCR,
  type Ability,
  type ChallengeRating,
  type Feature,
  type Skill,
  type StatblockData,
} from "./statblock";

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

type Rec = Record<string, unknown>;

/** Long ability names as used by Open5e (v1 `<name>_save`, v2 `ability_scores` / `saving_throws`). */
const ABILITY_NAMES: Record<Ability, string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};

export function importMonster(raw: unknown): StatblockData {
  if (!isRecord(raw)) throw new ImportError("Expected a JSON object");

  let data: StatblockData;
  if ("index" in raw && Array.isArray(raw.armor_class)) data = fromSrd(raw);
  else if ("slug" in raw) data = fromOpen5eV1(raw);
  else if ("key" in raw && "ability_scores" in raw) data = fromOpen5eV2(raw);
  else throw new ImportError("Unrecognised monster JSON (expected 5e SRD API, Open5e v1 or Open5e v2)");

  const parsed = StatblockSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ImportError(`Imported monster is not a valid stat block: ${issue.path.join(".")} ${issue.message}`);
  }
  return parsed.data;
}

function fromSrd(raw: Rec): StatblockData {
  const ac = isRecord(raw.armor_class) ? raw.armor_class : list(raw.armor_class)[0];
  const armorNames = ac ? list(ac.armor).map((a) => text(a.name).toLowerCase()) : [];
  const proficiencies = srdProficiencies(raw);

  return {
    name: text(raw.name),
    size: text(raw.size),
    type: text(raw.type),
    subtype: text(raw.subtype),
    alignment: text(raw.alignment),
    armorClass: {
      value: int(ac?.value, 10),
      description: armorNames.length > 0 ? armorNames.join(", ") : text(ac?.type),
    },
    hitPoints: {
      average: int(raw.hit_points),
      hitDice: text(raw.hit_points_roll) || text(raw.hit_dice),
    },
    speed: speeds(raw.speed),
    abilities: abilityScores(raw, (ability) => raw[ABILITY_NAMES[ability]]),
    savingThrows: proficiencies.savingThrows,
    skills: proficiencies.skills,
    damageVulnerabilities: entryNames(raw.damage_vulnerabilities),
    damageResistances: entryNames(raw.damage_resistances),
    damageImmunities: entryNames(raw.damage_immunities),
    conditionImmunities: entryNames(raw.condition_immunities),
    senses: sensesFromRecord(raw.senses),
    languages: text(raw.languages),
    challengeRating: challengeRating(raw.challenge_rating),
    xp: int(raw.xp),
    traits: features(raw.special_abilities),
    actions: features(raw.actions),
    reactions: features(raw.reactions),
    legendaryActions: features(raw.legendary_actions),
    legendaryDescription: "",
    description: text(raw.desc),
  };
}

function srdProficiencies(raw: Rec): {
  savingThrows: Partial<Record<Ability, number>>;
  skills: Partial<Record<Skill, number>>;
} {
  const savingThrows: Partial<Record<Ability, number>> = {};
  const skills: Partial<Record<Skill, number>> = {};
  for (const entry of list(raw.proficiencies)) {
    const index = isRecord(entry.proficiency) ? text(entry.proficiency.index) : "";
    const value = int(entry.value);
    if (index.startsWith("saving-throw-")) {
      const ability = toAbility(index.slice("saving-throw-".length));
      if (ability) savingThrows[ability] = value;
    } else if (index.startsWith("skill-")) {
      const skill = toSkill(index.slice("skill-".length));
      if (skill) skills[skill] = value;
    }
  }
  return { savingThrows, skills };
}

function fromOpen5eV1(raw: Rec): StatblockData {
  const cr = challengeRating(raw.challenge_rating);
  const savingThrows: Partial<Record<Ability, number>> = {};
  for (const ability of ABILITIES) {
    const value = raw[`${ABILITY_NAMES[ability]}_save`];
    if (typeof value === "number") savingThrows[ability] = Math.round(value);
  }

  return {
    name: text(raw.name),
    size: text(raw.size),
    type: text(raw.type),
    subtype: text(raw.subtype),
    alignment: text(raw.alignment),
    armorClass: { value: int(raw.armor_class, 10), description: text(raw.armor_desc) },
    hitPoints: { average: int(raw.hit_points), hitDice: text(raw.hit_dice) },
    speed: speeds(raw.speed),
    abilities: abilityScores(raw, (ability) => raw[ABILITY_NAMES[ability]]),
    savingThrows,
    skills: skillBonuses(raw.skills),
    damageVulnerabilities: entryNames(raw.damage_vulnerabilities),
    damageResistances: entryNames(raw.damage_resistances),
    damageImmunities: entryNames(raw.damage_immunities),
    conditionImmunities: entryNames(raw.condition_immunities),
    senses: text(raw.senses),
    languages: text(raw.languages),
    challengeRating: cr,
    xp: xpForCR(cr),
    traits: features(raw.special_abilities),
    actions: [...features(raw.actions), ...features(raw.bonus_actions, " (Bonus Action)")],
    reactions: features(raw.reactions),
    legendaryActions: features(raw.legendary_actions),
    legendaryDescription: text(raw.legendary_desc),
    description: text(raw.desc),
  };
}

const V2_ACTION_TYPES = {
  ACTION: "actions",
  BONUS_ACTION: "actions",
  REACTION: "reactions",
  LEGENDARY_ACTION: "legendaryActions",
} as const;

function fromOpen5eV2(raw: Rec): StatblockData {
  const scores = isRecord(raw.ability_scores) ? raw.ability_scores : {};
  const saves = isRecord(raw.saving_throws) ? raw.saving_throws : {};
  const savingThrows: Partial<Record<Ability, number>> = {};
  for (const ability of ABILITIES) {
    const value = saves[ABILITY_NAMES[ability]];
    if (typeof value === "number") savingThrows[ability] = Math.round(value);
  }

  const defenses = isRecord(raw.resistances_and_immunities) ? raw.resistances_and_immunities : {};
  const actions: Feature[] = [];
  const reactions: Feature[] = [];
  const legendaryActions: Feature[] = [];
  const buckets = { actions, reactions, legendaryActions };
  for (const action of list(raw.actions)) {
    const kind = V2_ACTION_TYPES[text(action.action_type) as keyof typeof V2_ACTION_TYPES] ?? "actions";
    const suffix = text(action.action_type) === "BONUS_ACTION" ? " (Bonus Action)" : "";
    buckets[kind].push({ name: text(action.name) + suffix, desc: text(action.desc) });
  }

  return {
    name: text(raw.name),
    size: isRecord(raw.size) ? text(raw.size.name) : "",
    type: isRecord(raw.type) ? text(raw.type.name) : "",
    subtype: text(raw.subcategory),
    alignment: text(raw.alignment),
    armorClass: { value: int(raw.armor_class, 10), description: text(raw.armor_detail) },
    hitPoints: { average: int(raw.hit_points), hitDice: text(raw.hit_dice) },
    speed: speeds(raw.speed),
    abilities: abilityScores(raw, (ability) => scores[ABILITY_NAMES[ability]]),
    savingThrows,
    skills: skillBonuses(raw.skill_bonuses),
    damageVulnerabilities: v2Defenses(defenses, "damage_vulnerabilities"),
    damageResistances: v2Defenses(defenses, "damage_resistances"),
    damageImmunities: v2Defenses(defenses, "damage_immunities"),
    conditionImmunities: v2Defenses(defenses, "condition_immunities"),
    senses: v2Senses(raw),
    languages: isRecord(raw.languages) ? text(raw.languages.as_string) : "",
    challengeRating: challengeRating(raw.challenge_rating),
    xp: int(raw.experience_points),
    traits: features(raw.traits),
    actions,
    reactions,
    legendaryActions,
    legendaryDescription: "",
    description: text(raw.desc),
  };
}

function v2Defenses(defenses: Rec, key: string): string[] {
  const entries = entryNames(defenses[key]);
  return entries.length > 0 ? entries : entryNames(defenses[`${key}_display`]);
}

const V2_SENSE_RANGES: [string, string][] = [
  ["blindsight_range", "blindsight"],
  ["darkvision_range", "darkvision"],
  ["tremorsense_range", "tremorsense"],
  ["truesight_range", "truesight"],
];

function v2Senses(raw: Rec): string {
  const parts: string[] = [];
  for (const [key, label] of V2_SENSE_RANGES) {
    const range = raw[key];
    if (typeof range === "number" && range > 0) parts.push(`${label} ${range} ft.`);
  }
  if (typeof raw.passive_perception === "number") {
    parts.push(`passive Perception ${Math.round(raw.passive_perception)}`);
  }
  return parts.join(", ");
}

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function int(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
}

function list(value: unknown): Rec[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function features(value: unknown, suffix = ""): Feature[] {
  return list(value).map((f) => ({ name: text(f.name) + suffix, desc: text(f.desc) }));
}

/** Damage/condition lists arrive as comma-separated strings, plain arrays or arrays of `{ name }`. */
function entryNames(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (isRecord(entry) ? text(entry.name).toLowerCase() : text(entry)))
    .filter((s) => s.length > 0);
}

function abilityScores(raw: Rec, read: (ability: Ability) => unknown): Record<Ability, number> {
  const scores = {} as Record<Ability, number>;
  for (const ability of ABILITIES) {
    scores[ability] = Math.min(30, Math.max(1, int(read(ability), 10)));
  }
  return scores;
}

function toAbility(key: string): Ability | null {
  const k = key.trim().toLowerCase();
  const long = ABILITIES.find((a) => ABILITY_NAMES[a] === k);
  if (long) return long;
  return (ABILITIES as readonly string[]).includes(k) ? (k as Ability) : null;
}

function toSkill(key: string): Skill | null {
  const k = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (SKILLS as readonly string[]).includes(k) ? (k as Skill) : null;
}

function skillBonuses(value: unknown): Partial<Record<Skill, number>> {
  const skills: Partial<Record<Skill, number>> = {};
  if (!isRecord(value)) return skills;
  for (const [key, bonus] of Object.entries(value)) {
    const skill = toSkill(key);
    if (skill && typeof bonus === "number") skills[skill] = Math.round(bonus);
  }
  return skills;
}

/** Speeds come as "30 ft." (SRD) or as numbers of feet (Open5e); `hover: true` qualifies the fly speed. */
function speeds(value: unknown): Record<string, string> {
  const speed: Record<string, string> = {};
  if (!isRecord(value)) return speed;
  const hover = value.hover === true ? " (hover)" : "";
  for (const [key, raw] of Object.entries(value)) {
    if (key === "hover" || key === "unit") continue;
    const suffix = key === "fly" ? hover : "";
    if (typeof raw === "string") speed[key] = raw + suffix;
    else if (typeof raw === "number" && raw > 0) speed[key] = `${raw} ft.${suffix}`;
  }
  return speed;
}

function sensesFromRecord(value: unknown): string {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return "";
  const parts: string[] = [];
  let passive = "";
  for (const [key, raw] of Object.entries(value)) {
    if (key === "passive_perception") {
      passive = `passive Perception ${int(raw)}`;
      continue;
    }
    const detail = typeof raw === "number" ? `${raw} ft.` : text(raw);
    if (detail) parts.push(`${key.replace(/_/g, " ")} ${detail}`);
  }
  if (passive) parts.push(passive);
  return parts.join(", ");
}

function isChallengeRating(value: string): value is ChallengeRating {
  return (CHALLENGE_RATINGS as readonly string[]).includes(value);
}

function challengeRating(value: unknown): ChallengeRating {
  const raw = typeof value === "number" ? formatCR(value) : text(value).trim();
  if (isChallengeRating(raw)) return raw;
  const n = crToNumber(raw);
  if (raw === "" || !Number.isFinite(n)) throw new ImportError("Missing or unrecognised challenge rating");
  // Ratings off the SRD table (homebrew fractions) snap to the nearest listed one.
  return CHALLENGE_RATINGS.reduce((best, cr) =>
    Math.abs(crToNumber(cr) - n) < Math.abs(crToNumber(best) - n) ? cr : best,
  );
}
