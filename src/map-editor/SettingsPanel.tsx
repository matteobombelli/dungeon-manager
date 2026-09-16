import { useEffect, useState } from "react";
import { ImageField } from "../components/ImageField";
import { MAP_LIMITS, type MapNodeData } from "../../shared/nodes/map";
import { resizeCells } from "./mapOps";

export interface SettingsPanelProps {
  data: MapNodeData;
  onChange: (next: MapNodeData) => void;
}

export function SettingsPanel({ data, onChange }: SettingsPanelProps) {
  function resize(cols: number, rows: number) {
    onChange({ ...data, cols, rows, cells: resizeCells(data, cols, rows) });
  }

  return (
    <section className="panel__body">
      <header className="panel__header">
        <span className="panel__title">Settings</span>
      </header>
      <label>
        Name
        <input type="text" value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })} />
      </label>
      <div className="editor-row">
        <IntField label="Columns" value={data.cols} min={1} max={MAP_LIMITS.maxCols} onCommit={(n) => resize(n, data.rows)} />
        <IntField label="Rows" value={data.rows} min={1} max={MAP_LIMITS.maxRows} onCommit={(n) => resize(data.cols, n)} />
        <IntField
          label="Cell px"
          value={data.cellSize}
          min={MAP_LIMITS.minCellSize}
          max={MAP_LIMITS.maxCellSize}
          onCommit={(n) => onChange({ ...data, cellSize: n })}
        />
      </div>
      <ImageField
        label="Background"
        assetId={data.backgroundAssetId}
        onChange={(assetId) => onChange({ ...data, backgroundAssetId: assetId })}
      />
      <label>
        Background opacity {Math.round(data.backgroundOpacity * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={data.backgroundOpacity}
          onChange={(e) => onChange({ ...data, backgroundOpacity: Number(e.target.value) })}
        />
      </label>
    </section>
  );
}

interface IntFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}

// Edits as free text and commits a clamped integer on blur/Enter, so partial values while typing are not rejected.
function IntField({ label, value, min, max, onCommit }: IntFieldProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  function commit() {
    const n = Math.round(Number(text));
    if (!Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, n));
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  }

  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
