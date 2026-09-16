import { useState, type ReactNode } from "react";
import { Import, Plus, X } from "lucide-react";
import {
  ABILITIES,
  CHALLENGE_RATINGS,
  SKILLS,
  STATBLOCK_SECTIONS,
  STATBLOCK_SECTION_LABELS,
  abilityModifier,
  formatModifier,
  xpForCR,
  type Ability,
  type ChallengeRating,
  type Feature,
  type Skill,
  type StatblockData,
  type StatblockSection,
} from "../../../shared/nodes/statblock";
import { IconButton } from "../../components/IconButton";
import { AddSectionMenu, EditorSection, useSections } from "../EditorSection";
import type { NodeEditorProps } from "../types";
import { ImportDialog } from "./ImportDialog";

const SPEED_MODES = ["walk", "fly", "swim", "climb", "burrow"];

export function StatblockEditor({ data, onChange }: NodeEditorProps<StatblockData>) {
  const [importOpen, setImportOpen] = useState(false);
  // Once the XP is typed by hand, changing the challenge rating no longer overwrites it.
  const [xpEdited, setXpEdited] = useState(false);

  const set = <K extends keyof StatblockData>(key: K, value: StatblockData[K]) => onChange({ ...data, [key]: value });

  const sections = useSections<StatblockSection>(data.hiddenSections, STATBLOCK_SECTIONS, (next) =>
    set("hiddenSections", next),
  );

  const setSpeed = (mode: string, value: string) => {
    const speed = { ...data.speed };
    if (value.trim() === "") delete speed[mode];
    else speed[mode] = value;
    set("speed", speed);
  };

  const setSave = (ability: Ability, bonus: number | undefined) => {
    const savingThrows = { ...data.savingThrows };
    if (bonus === undefined) delete savingThrows[ability];
    else savingThrows[ability] = bonus;
    set("savingThrows", savingThrows);
  };

  const setSkill = (skill: Skill, bonus: number | undefined) => {
    const skills = { ...data.skills };
    if (bonus === undefined) delete skills[skill];
    else skills[skill] = bonus;
    set("skills", skills);
  };

  const setCR = (cr: ChallengeRating) =>
    onChange({ ...data, challengeRating: cr, xp: xpEdited ? data.xp : xpForCR(cr) });

  const modes = [...SPEED_MODES, ...Object.keys(data.speed).filter((m) => !SPEED_MODES.includes(m))];

  const section = (id: StatblockSection, children: ReactNode, actions?: ReactNode) =>
    sections.isVisible(id) ? (
      <EditorSection
        id={id}
        title={STATBLOCK_SECTION_LABELS[id]}
        actions={actions}
        onRemove={() => sections.hide(id)}
      >
        {children}
      </EditorSection>
    ) : null;

  const features = (id: StatblockSection, items: Feature[], key: "traits" | "actions" | "reactions" | "legendaryActions", extra?: ReactNode) =>
    section(
      id,
      <>
        <FeatureList items={items} onChange={(next) => set(key, next)} />
        {extra}
      </>,
      <IconButton
        icon={Plus}
        label={`Add ${STATBLOCK_SECTION_LABELS[id].toLowerCase()}`}
        onClick={() => set(key, [...items, { name: "", desc: "" }])}
      />,
    );

  return (
    <>
      <div className="editor-actions">
        <IconButton icon={Import} label="Import JSON" onClick={() => setImportOpen(true)} />
      </div>

      {section(
        "identity",
        <>
          <label>
            Name
            <input value={data.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <div className="editor-row">
            <label>
              Size
              <input value={data.size} onChange={(e) => set("size", e.target.value)} />
            </label>
            <label>
              Type
              <input value={data.type} onChange={(e) => set("type", e.target.value)} />
            </label>
            <label>
              Subtype
              <input value={data.subtype} onChange={(e) => set("subtype", e.target.value)} />
            </label>
          </div>
          <label>
            Alignment
            <input value={data.alignment} onChange={(e) => set("alignment", e.target.value)} />
          </label>
        </>,
      )}

      {section(
        "defenses",
        <>
          <div className="editor-row">
            <label>
              Armour class
              <input
                type="number"
                min={0}
                value={data.armorClass.value}
                onChange={(e) => set("armorClass", { ...data.armorClass, value: wholeNumber(e.target.value) })}
              />
            </label>
            <label>
              Armour description
              <input
                value={data.armorClass.description}
                onChange={(e) => set("armorClass", { ...data.armorClass, description: e.target.value })}
              />
            </label>
          </div>
          <div className="editor-row">
            <label>
              Hit points
              <input
                type="number"
                min={0}
                value={data.hitPoints.average}
                onChange={(e) => set("hitPoints", { ...data.hitPoints, average: wholeNumber(e.target.value) })}
              />
            </label>
            <label>
              Hit dice
              <input
                value={data.hitPoints.hitDice}
                onChange={(e) => set("hitPoints", { ...data.hitPoints, hitDice: e.target.value })}
              />
            </label>
          </div>
          <div className="editor-grid">
            {modes.map((mode) => (
              <label key={mode}>
                {mode}
                <input
                  value={data.speed[mode] ?? ""}
                  placeholder="—"
                  onChange={(e) => setSpeed(mode, e.target.value)}
                />
              </label>
            ))}
          </div>
        </>,
      )}

      {section(
        "abilities",
        <div className="editor-grid">
          {ABILITIES.map((ability) => (
            <label key={ability} className={`ability ability--${ability}`}>
              {ability.toUpperCase()} ({formatModifier(abilityModifier(data.abilities[ability]))})
              <input
                type="number"
                min={1}
                max={30}
                value={data.abilities[ability]}
                onChange={(e) =>
                  set("abilities", {
                    ...data.abilities,
                    [ability]: Math.min(30, Math.max(1, wholeNumber(e.target.value, 10))),
                  })
                }
              />
            </label>
          ))}
        </div>,
      )}

      {section(
        "saves",
        <div className="editor-grid">
          {ABILITIES.map((ability) => (
            <BonusField
              key={ability}
              label={ability.toUpperCase()}
              className={`ability ability--${ability}`}
              value={data.savingThrows[ability]}
              onChange={(bonus) => setSave(ability, bonus)}
            />
          ))}
        </div>,
      )}

      {section(
        "skills",
        <div className="editor-grid">
          {SKILLS.map((skill) => (
            <BonusField
              key={skill}
              label={skill.replace(/_/g, " ")}
              value={data.skills[skill]}
              onChange={(bonus) => setSkill(skill, bonus)}
            />
          ))}
        </div>,
      )}

      {section(
        "resistances",
        <>
          <CommaListField
            key={`vuln:${data.damageVulnerabilities.join("|")}`}
            label="Damage vulnerabilities"
            value={data.damageVulnerabilities}
            onChange={(v) => set("damageVulnerabilities", v)}
          />
          <CommaListField
            key={`res:${data.damageResistances.join("|")}`}
            label="Damage resistances"
            value={data.damageResistances}
            onChange={(v) => set("damageResistances", v)}
          />
          <CommaListField
            key={`imm:${data.damageImmunities.join("|")}`}
            label="Damage immunities"
            value={data.damageImmunities}
            onChange={(v) => set("damageImmunities", v)}
          />
          <CommaListField
            key={`cond:${data.conditionImmunities.join("|")}`}
            label="Condition immunities"
            value={data.conditionImmunities}
            onChange={(v) => set("conditionImmunities", v)}
          />
          <label>
            Senses
            <input value={data.senses} onChange={(e) => set("senses", e.target.value)} />
          </label>
          <label>
            Languages
            <input value={data.languages} onChange={(e) => set("languages", e.target.value)} />
          </label>
        </>,
      )}

      {section(
        "challenge",
        <div className="editor-row">
          <label>
            Challenge rating
            <select value={data.challengeRating} onChange={(e) => setCR(e.target.value as ChallengeRating)}>
              {CHALLENGE_RATINGS.map((cr) => (
                <option key={cr} value={cr}>
                  {cr}
                </option>
              ))}
            </select>
          </label>
          <label>
            XP
            <input
              type="number"
              min={0}
              value={data.xp}
              onChange={(e) => {
                setXpEdited(true);
                set("xp", wholeNumber(e.target.value));
              }}
            />
          </label>
        </div>,
      )}

      {features("traits", data.traits, "traits")}
      {features("actions", data.actions, "actions")}
      {features("reactions", data.reactions, "reactions")}
      {features(
        "legendary",
        data.legendaryActions,
        "legendaryActions",
        <label>
          Legendary description
          <textarea
            value={data.legendaryDescription}
            onChange={(e) => set("legendaryDescription", e.target.value)}
          />
        </label>,
      )}

      {section(
        "description",
        <label>
          Description
          <textarea value={data.description} onChange={(e) => set("description", e.target.value)} />
        </label>,
      )}

      <AddSectionMenu
        hidden={sections.hiddenIds.map((id) => ({ id, label: STATBLOCK_SECTION_LABELS[id] }))}
        onAdd={sections.show}
      />

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={onChange} />
    </>
  );
}

function wholeNumber(value: string, fallback = 0): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && value.trim() !== "" ? Math.max(0, n) : fallback;
}

function BonusField({
  label,
  className,
  value,
  onChange,
}: {
  label: string;
  className?: string;
  value: number | undefined;
  onChange: (bonus: number | undefined) => void;
}) {
  return (
    <label className={className}>
      {label}
      <input
        type="number"
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === "" ? undefined : Math.round(Number(e.target.value) || 0))}
      />
    </label>
  );
}

/** Edits a string list as one comma-separated field; the text is only parsed back on blur. */
function CommaListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState(value.join(", "));
  return (
    <label>
      {label}
      <input
        value={text}
        placeholder="fire, cold"
        onChange={(e) => setText(e.target.value)}
        onBlur={() =>
          onChange(
            text
              .split(",")
              .map((entry) => entry.trim())
              .filter((entry) => entry !== ""),
          )
        }
      />
    </label>
  );
}

function FeatureList({ items, onChange }: { items: Feature[]; onChange: (next: Feature[]) => void }) {
  const update = (index: number, patch: Partial<Feature>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <>
      {items.map((item, index) => (
        <div key={index} className="statblock__feature">
          <div className="editor-row">
            <label>
              Name
              <input value={item.name} onChange={(e) => update(index, { name: e.target.value })} />
            </label>
            <IconButton
              icon={X}
              label={`Remove ${item.name || "feature"}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>
          <label>
            Description
            <textarea value={item.desc} onChange={(e) => update(index, { desc: e.target.value })} />
          </label>
        </div>
      ))}
    </>
  );
}
