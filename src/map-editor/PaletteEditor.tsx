import { Plus, X } from "lucide-react";
import { newId } from "../../shared/ids";
import { MAP_LIMITS, type MapNodeData } from "../../shared/nodes/map";
import { IconButton } from "../components/IconButton";
import { removePaletteEntry } from "./mapOps";

export interface PaletteEditorProps {
  data: MapNodeData;
  onChange: (next: MapNodeData) => void;
}

export function PaletteEditor({ data, onChange }: PaletteEditorProps) {
  function update(index: number, patch: { name?: string; color?: string }) {
    onChange({ ...data, palette: data.palette.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  }

  function add() {
    onChange({
      ...data,
      palette: [...data.palette, { id: newId(), name: `Terrain ${data.palette.length + 1}`, color: "#888888" }],
    });
  }

  return (
    <section className="panel__body">
      <header className="panel__header">
        <span className="panel__title">Palette</span>
        <IconButton icon={Plus} label="Add entry" onClick={add} disabled={data.palette.length >= MAP_LIMITS.maxPalette} />
      </header>
      <ul className="map-editor__palette">
        {data.palette.map((entry, i) => (
          <li key={entry.id} className="map-editor__palette-row">
            <input
              type="color"
              value={entry.color}
              aria-label={`${entry.name} colour`}
              onChange={(e) => update(i, { color: e.target.value })}
            />
            <input
              type="text"
              value={entry.name}
              aria-label="Palette entry name"
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <IconButton icon={X} label={`Delete ${entry.name}`} onClick={() => onChange(removePaletteEntry(data, i))} />
          </li>
        ))}
      </ul>
    </section>
  );
}
