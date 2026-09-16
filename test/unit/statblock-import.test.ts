import { describe, expect, it } from "vitest";
import { StatblockSchema } from "../../shared/nodes/statblock";
import { ImportError, importMonster } from "../../shared/nodes/statblock-import";
import srdGoblin from "./fixtures/srd-goblin.json";
import srdDragon from "./fixtures/srd-adult-red-dragon.json";
import v1Goblin from "./fixtures/open5e-v1-goblin.json";
import v1Dragon from "./fixtures/open5e-v1-adult-red-dragon.json";
import v2Goblin from "./fixtures/open5e-v2-goblin.json";
import v2Dragon from "./fixtures/open5e-v2-adult-red-dragon.json";

describe.each([
  ["5e SRD API", srdGoblin, srdDragon],
  ["Open5e v1", v1Goblin, v1Dragon],
  ["Open5e v2", v2Goblin, v2Dragon],
])("%s", (_source, goblin, dragon) => {
  it("imports a goblin", () => {
    const data = importMonster(goblin);
    expect(StatblockSchema.safeParse(data).success).toBe(true);

    expect(data.name).toBe("Goblin");
    expect(data.size).toBe("Small");
    expect(data.type.toLowerCase()).toBe("humanoid");
    expect(data.armorClass.value).toBe(15);
    expect(data.armorClass.description).toContain("leather armor");
    expect(data.hitPoints).toEqual({ average: 7, hitDice: "2d6" });
    expect(data.speed.walk).toBe("30 ft.");
    expect(data.abilities).toEqual({ str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 });
    expect(data.savingThrows).toEqual({});
    expect(data.skills.stealth).toBe(6);
    expect(data.senses).toContain("darkvision 60 ft.");
    expect(data.senses).toContain("passive Perception 9");
    expect(data.languages).toBe("Common, Goblin");
    expect(data.challengeRating).toBe("1/4");
    expect(data.xp).toBe(50);
    expect(data.traits).toHaveLength(1);
    expect(data.traits[0].name).toBe("Nimble Escape");
    expect(data.actions).toHaveLength(2);
    expect(data.actions[0].name).toBe("Scimitar");
    expect(data.actions[0].desc).toContain("Hit: 5 (1d6 + 2) slashing damage.");
    expect(data.legendaryActions).toEqual([]);
  });

  it("imports an adult red dragon", () => {
    const data = importMonster(dragon);
    expect(StatblockSchema.safeParse(data).success).toBe(true);

    expect(data.name).toBe("Adult Red Dragon");
    expect(data.size).toBe("Huge");
    expect(data.type.toLowerCase()).toBe("dragon");
    expect(data.armorClass.value).toBe(19);
    expect(data.armorClass.description).toContain("natural");
    expect(data.hitPoints).toEqual({ average: 256, hitDice: "19d12+133" });
    expect(data.speed.fly).toBe("80 ft.");
    expect(data.abilities).toEqual({ str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 });
    expect(data.savingThrows).toEqual({ dex: 6, con: 13, wis: 7, cha: 11 });
    expect(data.skills).toEqual({ perception: 13, stealth: 6 });
    expect(data.damageImmunities).toEqual(["fire"]);
    expect(data.senses).toContain("blindsight 60 ft.");
    expect(data.senses).toContain("darkvision 120 ft.");
    expect(data.senses).toContain("passive Perception 23");
    expect(data.challengeRating).toBe("17");
    expect(data.xp).toBe(18000);
    expect(data.actions).toHaveLength(6);
    expect(data.legendaryActions).toHaveLength(3);
    expect(data.legendaryActions[0].name).toBe("Detect");
  });
});

describe("source specifics", () => {
  it("keeps the Open5e v1 legendary description", () => {
    expect(importMonster(v1Dragon).legendaryDescription).toContain("3 legendary actions");
  });

  it("takes the Open5e v2 subcategory as the subtype", () => {
    expect(importMonster(v2Dragon).subtype).toBe("Dragons, Chromatic");
    expect(importMonster(srdGoblin).subtype).toBe("goblinoid");
  });

  it("marks Open5e bonus actions in the action list", () => {
    const raw = { ...v1Goblin, bonus_actions: [{ name: "Nimble Escape", desc: "Disengage or Hide." }] };
    const data = importMonster(raw);
    expect(data.actions).toHaveLength(3);
    expect(data.actions[2].name).toBe("Nimble Escape (Bonus Action)");
  });

  it("qualifies a hovering fly speed", () => {
    const raw = { ...v1Goblin, speed: { walk: 30, fly: 60, hover: true } };
    expect(importMonster(raw).speed).toEqual({ walk: "30 ft.", fly: "60 ft. (hover)" });
  });

  it("maps multi-word skill and saving throw proficiencies", () => {
    const raw = {
      ...srdGoblin,
      proficiencies: [
        { value: 4, proficiency: { index: "skill-sleight-of-hand", name: "Skill: Sleight of Hand" } },
        { value: 3, proficiency: { index: "skill-animal-handling", name: "Skill: Animal Handling" } },
        { value: 2, proficiency: { index: "saving-throw-dex", name: "Saving Throw: DEX" } },
      ],
    };
    const data = importMonster(raw);
    expect(data.skills).toEqual({ sleight_of_hand: 4, animal_handling: 3 });
    expect(data.savingThrows).toEqual({ dex: 2 });
  });
});

describe("unknown input", () => {
  it.each([
    ["a string", '"goblin"'],
    ["an array", "[]"],
    ["an unrelated object", '{ "name": "Goblin", "hp": 7 }'],
    ["an empty object", "{}"],
  ])("throws ImportError for %s", (_label, json) => {
    expect(() => importMonster(JSON.parse(json))).toThrow(ImportError);
  });

  it("throws ImportError when a recognised shape has no challenge rating", () => {
    const { challenge_rating: _cr, ...rest } = v1Goblin;
    expect(() => importMonster(rest)).toThrow(ImportError);
  });
});
