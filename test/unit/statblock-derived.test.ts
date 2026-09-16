import { describe, expect, it } from "vitest";
import {
  CHALLENGE_RATINGS,
  abilityModifier,
  crToNumber,
  defaultData,
  formatCR,
  formatModifier,
  passivePerception,
  proficiencyBonusForCR,
  xpForCR,
} from "../../shared/nodes/statblock";

describe("abilityModifier", () => {
  it("floors the halved offset from 10", () => {
    expect(abilityModifier(1)).toBe(-5);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(9)).toBe(-1);
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(14)).toBe(2);
    expect(abilityModifier(27)).toBe(8);
    expect(abilityModifier(30)).toBe(10);
  });
});

describe("formatModifier", () => {
  it("signs the number", () => {
    expect(formatModifier(0)).toBe("+0");
    expect(formatModifier(3)).toBe("+3");
    expect(formatModifier(-1)).toBe("-1");
  });
});

describe("challenge rating conversion", () => {
  it("round trips every listed rating", () => {
    for (const cr of CHALLENGE_RATINGS) {
      expect(formatCR(crToNumber(cr))).toBe(cr);
    }
  });

  it("maps fractions both ways", () => {
    expect(crToNumber("1/8")).toBe(0.125);
    expect(crToNumber("1/4")).toBe(0.25);
    expect(crToNumber("1/2")).toBe(0.5);
    expect(crToNumber("17")).toBe(17);
    expect(formatCR(0.125)).toBe("1/8");
    expect(formatCR(0.5)).toBe("1/2");
    expect(formatCR(17)).toBe("17");
  });
});

describe("proficiencyBonusForCR", () => {
  it("steps every four ratings from CR 1", () => {
    expect(proficiencyBonusForCR("0")).toBe(2);
    expect(proficiencyBonusForCR("1/4")).toBe(2);
    expect(proficiencyBonusForCR("4")).toBe(2);
    expect(proficiencyBonusForCR("5")).toBe(3);
    expect(proficiencyBonusForCR("9")).toBe(4);
    expect(proficiencyBonusForCR("13")).toBe(5);
    expect(proficiencyBonusForCR("17")).toBe(6);
    expect(proficiencyBonusForCR("30")).toBe(9);
  });
});

describe("xpForCR", () => {
  it("returns the SRD award", () => {
    expect(xpForCR("0")).toBe(10);
    expect(xpForCR("1/4")).toBe(50);
    expect(xpForCR("1")).toBe(200);
    expect(xpForCR("17")).toBe(18000);
    expect(xpForCR("30")).toBe(155000);
  });

  it("returns 0 for a rating outside the table", () => {
    expect(xpForCR("99")).toBe(0);
  });
});

describe("passivePerception", () => {
  it("uses the perception skill bonus when present", () => {
    const data = { ...defaultData(), abilities: { ...defaultData().abilities, wis: 13 }, skills: { perception: 13 } };
    expect(passivePerception(data)).toBe(23);
  });

  it("falls back to the wisdom modifier", () => {
    const data = { ...defaultData(), abilities: { ...defaultData().abilities, wis: 8 } };
    expect(passivePerception(data)).toBe(9);
  });
});
