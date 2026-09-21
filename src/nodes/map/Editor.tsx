import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { MapNodeData } from "../../../shared/nodes/map";
import { MapEditorModal } from "../../map-editor/MapEditorModal";
import type { NodeEditorProps } from "../types";

export function MapEditor({ data, onChange, openRequest }: NodeEditorProps<MapNodeData>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (openRequest) setOpen(true);
  }, [openRequest]);

  return (
    <>
      <label>
        Name
        <input type="text" value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })} />
      </label>
      <button type="button" className="button--primary map-node__open" onClick={() => setOpen(true)}>
        <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
        Open map editor
      </button>
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
