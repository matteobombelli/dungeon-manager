import type { ReactNode } from "react";
import {
  CHARACTER_SECTIONS,
  CHARACTER_SECTION_LABELS,
  type CharacterData,
  type CharacterSection,
} from "../../../shared/nodes/character";
import { ImageField } from "../../components/ImageField";
import { AddSectionMenu, EditorSection, useSections } from "../EditorSection";
import type { NodeEditorProps } from "../types";

export function CharacterEditor({ data, onChange }: NodeEditorProps<CharacterData>) {
  const set = <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => onChange({ ...data, [key]: value });

  const sections = useSections<CharacterSection>(data.hiddenSections, CHARACTER_SECTIONS, (next) =>
    set("hiddenSections", next),
  );

  const section = (id: CharacterSection, children: ReactNode) =>
    sections.isVisible(id) ? (
      <EditorSection id={id} title={CHARACTER_SECTION_LABELS[id]} onRemove={() => sections.hide(id)}>
        {children}
      </EditorSection>
    ) : null;

  return (
    <>
      <label>
        Name
        <input value={data.name} onChange={(e) => set("name", e.target.value)} />
      </label>

      {section(
        "portrait",
        <ImageField label="Portrait" assetId={data.portraitAssetId} onChange={(id) => set("portraitAssetId", id)} />,
      )}

      {section(
        "details",
        <div className="editor-row">
          <label>
            Race
            <input value={data.race} onChange={(e) => set("race", e.target.value)} />
          </label>
          <label>
            Class
            <input value={data.class} onChange={(e) => set("class", e.target.value)} />
          </label>
          <label>
            Level
            <input
              type="number"
              min={1}
              max={20}
              value={data.level}
              onChange={(e) => set("level", Math.min(20, Math.max(1, Math.round(Number(e.target.value) || 1))))}
            />
          </label>
        </div>,
      )}

      {section(
        "player",
        <label className="editor-inline">
          <input type="checkbox" checked={data.isPlayer} onChange={(e) => set("isPlayer", e.target.checked)} />
          Player character
        </label>,
      )}

      {section(
        "description",
        <label>
          Description
          <textarea value={data.description} onChange={(e) => set("description", e.target.value)} />
        </label>,
      )}

      {section(
        "notes",
        <label>
          Notes
          <textarea value={data.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>,
      )}

      <AddSectionMenu
        hidden={sections.hiddenIds.map((id) => ({ id, label: CHARACTER_SECTION_LABELS[id] }))}
        onAdd={sections.show}
      />
    </>
  );
}
