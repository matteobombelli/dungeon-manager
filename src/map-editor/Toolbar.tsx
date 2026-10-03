import { Eraser, Grid2x2, PaintBucket, Paintbrush, Pen, Spline, Undo2, type LucideIcon } from "lucide-react";
import { MAP_LIMITS, type MapPaletteEntry } from "../../shared/nodes/map";
import { IconButton } from "../components/IconButton";
import { RangeInput } from "../components/RangeInput";
import { MAX_BRUSH_SIZE, ZOOM_LEVELS, type Tool, type ToolState } from "./tools";

export interface ToolbarProps {
  tools: ToolState;
  palette: MapPaletteEntry[];
  onChange: (patch: Partial<ToolState>) => void;
  canUndo: boolean;
  onUndo: () => void;
}

const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: "paint", label: "Paint", icon: Paintbrush },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "pen", label: "Pen", icon: Pen },
  { id: "erase", label: "Erase", icon: Eraser },
];

export function Toolbar({ tools, palette, onChange, canUndo, onUndo }: ToolbarProps) {
  return (
    <div className="map-editor__toolbar">
      <div className="map-editor__group" role="group" aria-label="Tool">
        {TOOLS.map((t) => (
          <IconButton key={t.id} icon={t.icon} label={t.label} active={tools.tool === t.id} onClick={() => onChange({ tool: t.id })} />
        ))}
      </div>

      {(tools.tool === "paint" || tools.tool === "fill") && (
        <div className="map-editor__group" role="group" aria-label="Palette">
          {palette.length === 0 && <span className="muted">Add a palette entry to {tools.tool}</span>}
          {palette.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              className={`map-editor__swatch${tools.paletteIndex === i ? " map-editor__swatch--active" : ""}`}
              style={{ background: entry.color }}
              title={entry.name}
              aria-label={entry.name}
              aria-pressed={tools.paletteIndex === i}
              onClick={() => onChange({ paletteIndex: i })}
            />
          ))}
        </div>
      )}

      {tools.tool === "pen" && (
        <div className="map-editor__group">
          <label className="map-editor__field">
            Colour
            <input type="color" value={tools.penColor} onChange={(e) => onChange({ penColor: e.target.value })} />
          </label>
          <label className="map-editor__field">
            Width {tools.penWidth}
            <RangeInput
              min={1}
              max={MAP_LIMITS.maxStrokeWidth}
              value={tools.penWidth}
              onChange={(e) => onChange({ penWidth: Number(e.target.value) })}
            />
          </label>
        </div>
      )}

      {tools.tool === "erase" && (
        <div className="map-editor__group" role="group" aria-label="Erase mode">
          <IconButton icon={Grid2x2} label="Erase cells" active={tools.eraseMode === "cells"} onClick={() => onChange({ eraseMode: "cells" })} />
          <IconButton icon={Spline} label="Erase strokes" active={tools.eraseMode === "strokes"} onClick={() => onChange({ eraseMode: "strokes" })} />
        </div>
      )}

      {(tools.tool === "paint" || (tools.tool === "erase" && tools.eraseMode === "cells")) && (
        <div className="map-editor__group">
          <label className="map-editor__field">
            Size {tools.brushSize}
            <RangeInput
              min={1}
              max={MAX_BRUSH_SIZE}
              value={tools.brushSize}
              onChange={(e) => onChange({ brushSize: Number(e.target.value) })}
            />
          </label>
        </div>
      )}

      <div className="map-editor__group map-editor__group--end">
        <label className="map-editor__field">
          Zoom
          <select value={tools.zoom} onChange={(e) => onChange({ zoom: Number(e.target.value) })}>
            {ZOOM_LEVELS.map((z) => (
              <option key={z} value={z}>
                {z * 100}%
              </option>
            ))}
          </select>
        </label>
        <IconButton icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
      </div>
    </div>
  );
}
