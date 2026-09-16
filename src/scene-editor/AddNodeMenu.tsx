import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Prefab } from "../../shared/api";
import { NODE_TYPE_IDS, NODE_TYPES, type NodeTypeId } from "../../shared/nodes/registry";
import { IconButton } from "../components/IconButton";
import { NODE_SHAPES, type NodeShape } from "../nodes/shapes";

export interface AddNodeMenuProps {
  prefabs: Prefab[];
  onAdd: (type: NodeTypeId, data: Record<string, unknown>) => void;
}

export function AddNodeMenu({ prefabs, onAdd }: AddNodeMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Claims the key so the scene editor's Escape (close scene) does not fire on the same press.
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

  return (
    <div className="add-menu" ref={root}>
      <IconButton
        icon={Plus}
        label="Add node"
        active={open}
        ariaHasPopup="menu"
        ariaExpanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul className="add-menu__list" role="menu">
          {NODE_TYPE_IDS.map((id) => (
            <li key={id} role="none">
              <Entry shape={NODE_SHAPES[id]} tone={id} label={NODE_TYPES[id].label} onClick={() => pick(id, NODE_TYPES[id].defaultData())} />
            </li>
          ))}
          {prefabs.map((p) => (
            <li key={p.id} role="none">
              <Entry
                shape="diamond"
                tone="custom"
                label={p.name}
                onClick={() => pick("custom", { prefabId: p.id, prefabName: p.name, fields: p.fields, values: {} })}
              />
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
