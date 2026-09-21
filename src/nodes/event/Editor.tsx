import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { newId } from "../../../shared/ids";
import {
  EVENT_SECTIONS,
  EVENT_SECTION_LABELS,
  type EventCheck,
  type EventCheckSkill,
  type EventData,
  type EventSection,
} from "../../../shared/nodes/event";
import { ABILITIES, SKILLS, SKILL_ABILITY, type Ability } from "../../../shared/nodes/statblock";
import { IconButton } from "../../components/IconButton";
import { AddSectionMenu, EditorSection, useSections } from "../EditorSection";
import type { NodeEditorProps } from "../types";

const MAX_CHECKS = 20;
const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export function EventEditor({ data, onChange }: NodeEditorProps<EventData>) {
  const setChecks = (checks: EventCheck[]) => onChange({ ...data, checks });
  const updateCheck = (id: string, patch: Partial<EventCheck>) =>
    setChecks(data.checks.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const sections = useSections<EventSection>(data.hiddenSections, EVENT_SECTIONS, (next) =>
    onChange({ ...data, hiddenSections: next }),
  );

  const addCheck = () =>
    setChecks([
      ...data.checks,
      { id: newId(), ability: "wis", skill: null, dc: 10, successText: "", failureText: "" },
    ]);

  // A skill belongs to one ability, so switching ability drops a skill that no longer fits.
  // A saving throw and a plain ability check survive the switch.
  const setAbility = (c: EventCheck, ability: Ability) =>
    updateCheck(c.id, {
      ability,
      skill: c.skill !== null && c.skill !== "save" && SKILL_ABILITY[c.skill] !== ability ? null : c.skill,
    });

  const section = (id: EventSection, children: ReactNode, actions?: ReactNode) =>
    sections.isVisible(id) ? (
      <EditorSection id={id} title={EVENT_SECTION_LABELS[id]} actions={actions} onRemove={() => sections.hide(id)}>
        {children}
      </EditorSection>
    ) : null;

  return (
    <>
      <label>
        Title
        <input value={data.title} onChange={(e) => onChange({ ...data, title: e.target.value })} />
      </label>

      {section(
        "description",
        <label>
          Description
          <textarea value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} />
        </label>,
      )}

      {section(
        "checks",
        <>
          {data.checks.map((c) => (
            <div key={c.id} className={`editor-group event-check ability--${c.ability}`}>
              <div className="editor-row">
                <label>
                  Ability
                  <select value={c.ability} onChange={(e) => setAbility(c, e.target.value as Ability)}>
                    {ABILITIES.map((a) => (
                      <option key={a} value={a}>
                        {ABILITY_NAMES[a]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Skill
                  <select
                    value={c.skill ?? ""}
                    onChange={(e) =>
                      updateCheck(c.id, { skill: e.target.value === "" ? null : (e.target.value as EventCheckSkill) })
                    }
                  >
                    <option value="">None</option>
                    <option value="save">Saving throw</option>
                    {/* A check stored before its skill's ability changed keeps a skill this ability
                        does not list; without an option for it the control would read "None". */}
                    {c.skill !== null && c.skill !== "save" && SKILL_ABILITY[c.skill] !== c.ability && (
                      <option value={c.skill}>{c.skill.replace(/_/g, " ")}</option>
                    )}
                    {SKILLS.filter((s) => SKILL_ABILITY[s] === c.ability).map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="editor-row">
                <label>
                  DC
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={c.dc}
                    onChange={(e) => updateCheck(c.id, { dc: Math.min(40, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                  />
                </label>
                <IconButton icon={X} label="Remove check" onClick={() => setChecks(data.checks.filter((x) => x.id !== c.id))} />
              </div>
              <label>
                On success
                <textarea value={c.successText} onChange={(e) => updateCheck(c.id, { successText: e.target.value })} />
              </label>
              <label>
                On failure
                <textarea value={c.failureText} onChange={(e) => updateCheck(c.id, { failureText: e.target.value })} />
              </label>
            </div>
          ))}
        </>,
        <IconButton icon={Plus} label="Add check" onClick={addCheck} disabled={data.checks.length >= MAX_CHECKS} />,
      )}

      <AddSectionMenu
        hidden={sections.hiddenIds.map((id) => ({ id, label: EVENT_SECTION_LABELS[id] }))}
        onAdd={sections.show}
      />
    </>
  );
}
