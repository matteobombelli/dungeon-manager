import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { GROUP_CHILD_TYPE_IDS, NODE_TYPE_IDS, NODE_TYPES, type NodeTypeId } from "../../shared/nodes/registry";
import { NODE_SHAPES, type NodeShape } from "../nodes/shapes";

export interface AddNodeMenuProps {
  onAdd: (type: NodeTypeId, data: Record<string, unknown>) => void;
  /** Groups do not nest, so the entry is hidden inside one. */
  allowGroups: boolean;
  /** Opens the list above the button, for the floating button in the canvas corner. */
  up?: boolean;
}

export function AddNodeMenu({ onAdd, allowGroups, up }: AddNodeMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Claims the key so the canvas's Escape (close the layer) does not fire on the same press.
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (type: NodeTypeId, data: Record<string, unknown>) => {
    onAdd(type, data);
    setOpen(false);
  };

  const types: readonly NodeTypeId[] = allowGroups ? NODE_TYPE_IDS : GROUP_CHILD_TYPE_IDS;

  return (
    <div className="add-menu" ref={root}>
      <button
        type="button"
        className="canvas-fab"
        aria-label="Add node"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Plus size={18} aria-hidden="true" /> <span>Node</span>
      </button>
      {open && (
        <ul className={`add-menu__list${up ? " add-menu--up" : ""}`} role="menu">
          {types.map((id) => (
            <li key={id} role="none">
              <Entry shape={NODE_SHAPES[id]} tone={id} label={NODE_TYPES[id].label} onClick={() => pick(id, NODE_TYPES[id].defaultData())} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Entry({ shape, tone, label, onClick }: { shape: NodeShape; tone: string; label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="add-menu__item" onClick={onClick}>
      <span className={`node-card node-card--${shape} node-card--${tone} node-card--glyph`} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
