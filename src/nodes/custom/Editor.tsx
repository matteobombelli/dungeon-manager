import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { CustomNodeData } from "../../../shared/nodes/custom";
import { slugifyKey, type CustomField, type CustomFieldKind } from "../../../shared/nodes/custom-fields";
import { IconButton } from "../../components/IconButton";
import { ImageField } from "../../components/ImageField";
import type { NodeEditorProps } from "../types";
import "../editor-section.css";

const KINDS: CustomFieldKind[] = ["text", "number", "image"];
const MAX_FIELDS = 40;

/** Keys stay fixed once a field exists, so they are only derived (and de-duplicated) at creation. */
function uniqueKey(base: string, fields: CustomField[]): string {
  const taken = new Set(fields.map((f) => f.key));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const key = `${base.slice(0, 36)}_${n}`;
    if (!taken.has(key)) return key;
  }
}

export function CustomEditor({ data, onChange }: NodeEditorProps<CustomNodeData>) {
  const setValue = (key: string, value: string | number | null) =>
    onChange({ ...data, values: { ...data.values, [key]: value } });

  const setFields = (fields: CustomField[]) => onChange({ ...data, fields });

  const addField = () => {
    const label = `Field ${data.fields.length + 1}`;
    const key = uniqueKey(slugifyKey(label) || `field_${data.fields.length + 1}`, data.fields);
    setFields([...data.fields, { key, label, kind: "text" }]);
  };

  const renameField = (index: number, label: string) =>
    setFields(data.fields.map((f, i) => (i === index ? { ...f, label } : f)));

  // A value of the old kind is not a legal value of the new one, so it goes with the change.
  const setKind = (index: number, kind: CustomFieldKind) => {
    const values = { ...data.values };
    delete values[data.fields[index].key];
    onChange({ ...data, fields: data.fields.map((f, i) => (i === index ? { ...f, kind } : f)), values });
  };

  const removeField = (index: number) => {
    const values = { ...data.values };
    delete values[data.fields[index].key];
    onChange({ ...data, fields: data.fields.filter((_, i) => i !== index), values });
  };

  const moveField = (index: number, delta: number) => {
    const fields = [...data.fields];
    const [field] = fields.splice(index, 1);
    fields.splice(index + delta, 0, field);
    setFields(fields);
  };

  return (
    <>
      {data.fields.map((f, index) => (
        <div key={f.key} className="custom-field">
          <div className="editor-row">
            <label>
              Label
              <input value={f.label} onChange={(e) => renameField(index, e.target.value)} />
            </label>
            <label>
              Kind
              <select value={f.kind} onChange={(e) => setKind(index, e.target.value as CustomFieldKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <IconButton
              icon={ChevronUp}
              label="Move field up"
              disabled={index === 0}
              onClick={() => moveField(index, -1)}
            />
            <IconButton
              icon={ChevronDown}
              label="Move field down"
              disabled={index === data.fields.length - 1}
              onClick={() => moveField(index, 1)}
            />
            <IconButton
              icon={X}
              label="Remove field"
              disabled={data.fields.length === 1}
              onClick={() => removeField(index)}
            />
          </div>
          <FieldInput field={f} value={data.values[f.key]} onChange={(v) => setValue(f.key, v)} />
        </div>
      ))}
      <div className="editor-actions">
        <IconButton icon={Plus} label="Add field" disabled={data.fields.length >= MAX_FIELDS} onClick={addField} />
      </div>
    </>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: string | number | null | undefined;
  onChange: (v: string | number | null) => void;
}) {
  switch (field.kind) {
    case "text":
      return (
        <label>
          Value
          <textarea value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case "number":
      return (
        <label>
          Value
          <input
            type="number"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
        </label>
      );
    case "image":
      return <ImageField label="Value" assetId={typeof value === "string" ? value : null} onChange={onChange} />;
  }
}
