import { useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { ColorField } from "../components/ColorField";
import { IconButton } from "../components/IconButton";
import type { SceneNode } from "./CampaignGraph";

export interface ScenePanelProps {
  node: SceneNode;
  autoFocus?: boolean;
  onRename: (name: string) => void;
  onChangeColor: (color: string | null) => void;
  onOpen: () => void;
  onDelete: () => void;
}

export function ScenePanel({ node, autoFocus, onRename, onChangeColor, onOpen, onDelete }: ScenePanelProps) {
  const [name, setName] = useState(node.data.name);
  useEffect(() => setName(node.data.name), [node.data.name]);

  function commit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === node.data.name) {
      setName(node.data.name);
      return;
    }
    onRename(trimmed);
  }

  return (
    <div className="panel__body">
      <header className="panel__header hover-actions">
        <input
          className="inline-edit"
          aria-label="Scene name"
          value={name}
          maxLength={120}
          autoFocus={autoFocus}
          onFocus={(e) => autoFocus && e.currentTarget.select()}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setName(node.data.name);
          }}
        />
        <IconButton icon={Trash2} label="Delete scene" danger onClick={onDelete} />
      </header>
      <ColorField label="Colour" value={node.data.color} onChange={onChangeColor} />
      <button type="button" className="button--primary" onClick={onOpen}>
        <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" /> Open scene
      </button>
    </div>
  );
}
