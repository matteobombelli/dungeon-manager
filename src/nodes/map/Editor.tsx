import { useState } from "react";
import { Maximize2 } from "lucide-react";
import type { MapNodeData } from "../../../shared/nodes/map";
import { IconButton } from "../../components/IconButton";
import { MapEditorModal } from "../../map-editor/MapEditorModal";
import type { NodeEditorProps } from "../types";

export function MapEditor({ data, onChange }: NodeEditorProps<MapNodeData>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="editor-inline">
        <label>
          Name
          <input type="text" value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })} />
        </label>
        <IconButton icon={Maximize2} label="Open map editor" onClick={() => setOpen(true)} />
      </div>
      <p className="muted">
        {data.cols} × {data.rows} cells, {data.strokes.length} strokes
      </p>
      <MapEditorModal
        open={open}
        data={data}
        onApply={(next) => {
          onChange(next);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
