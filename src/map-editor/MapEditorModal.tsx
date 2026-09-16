import { useEffect, useRef, useState, type RefObject } from "react";
import { assets } from "../api/endpoints";
import { Modal } from "../components/Modal";
import { MapNodeSchema, type MapNodeData } from "../../shared/nodes/map";
import { MapCanvas } from "./MapCanvas";
import { PaletteEditor } from "./PaletteEditor";
import { SettingsPanel } from "./SettingsPanel";
import { Toolbar } from "./Toolbar";
import { DEFAULT_TOOL_STATE, type ToolState } from "./tools";
import "./map-editor.css";

export interface MapEditorModalProps {
  open: boolean;
  data: MapNodeData;
  onApply: (next: MapNodeData) => void;
  onClose: () => void;
}

export function MapEditorModal({ open, data, onApply, onClose }: MapEditorModalProps) {
  const dirty = useRef(false);
  useEffect(() => {
    if (open) dirty.current = false;
  }, [open]);
  const close = () => {
    if (dirty.current && !confirm("Discard unsaved map changes?")) return;
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title="Map editor" size="full">
      {open && <EditorBody initial={data} onApply={onApply} dirty={dirty} />}
    </Modal>
  );
}

interface EditorBodyProps {
  initial: MapNodeData;
  onApply: (next: MapNodeData) => void;
  dirty: RefObject<boolean>;
}

// Mounted fresh each time the modal opens, so the draft always starts from the current node data.
function EditorBody({ initial, onApply, dirty }: EditorBodyProps) {
  const [draft, setDraft] = useState(initial);
  const [undo, setUndo] = useState<MapNodeData | null>(null);
  const [tools, setTools] = useState<ToolState>(DEFAULT_TOOL_STATE);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const image = useBackgroundImage(draft.backgroundAssetId);

  function commit(next: MapNodeData) {
    dirty.current = true;
    setUndo(draft);
    setDraft(next);
    setError(null);
  }

  function undoLast() {
    if (!undo) return;
    setDraft(undo);
    setUndo(null);
  }

  function apply() {
    const result = MapNodeSchema.safeParse(draft);
    if (!result.success) {
      const issue = result.error.issues[0];
      setError(issue ? `${issue.path.join(".") || "map"}: ${issue.message}` : "Invalid map");
      return;
    }
    dirty.current = false;
    onApply(result.data);
  }

  const effectiveTools: ToolState = {
    ...tools,
    paletteIndex: Math.min(tools.paletteIndex, Math.max(0, draft.palette.length - 1)),
  };

  return (
    <div className="map-editor">
      <Toolbar
        tools={effectiveTools}
        palette={draft.palette}
        onChange={(patch) => setTools((t) => ({ ...t, ...patch }))}
        canUndo={undo !== null}
        onUndo={undoLast}
      />
      <div className="map-editor__body">
        <div className="map-editor__canvas-area">
          <MapCanvas data={draft} tools={effectiveTools} image={image} onCommit={commit} onWarning={setWarning} />
        </div>
        <aside className="map-editor__side">
          <PaletteEditor data={draft} onChange={commit} />
          <SettingsPanel data={draft} onChange={commit} />
        </aside>
      </div>
      <footer className="map-editor__footer">
        <span className="map-editor__message">
          {error && <span className="form__error">{error}</span>}
          {!error && warning && <span className="muted">{warning}</span>}
        </span>
        <button type="button" className="button--primary" onClick={apply}>
          Apply
        </button>
      </footer>
    </div>
  );
}

function useBackgroundImage(assetId: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImage(null);
    if (!assetId) return;
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) setImage(img);
    };
    img.onerror = () => {
      if (active) setImage(null);
    };
    img.src = assets.url(assetId);
    return () => {
      active = false;
    };
  }, [assetId]);
  return image;
}
