import { Trash2 } from "lucide-react";
import { CAMPAIGN_GRAPH_LIMITS } from "../../shared/campaign-graph";
import { ColorField } from "../components/ColorField";
import { IconButton } from "../components/IconButton";
import type { RouteEdge } from "./RouteEdge";

export interface LinkPanelProps {
  edge: RouteEdge;
  onChangeLabel: (label: string) => void;
  onChangeColor: (color: string | null) => void;
  onDelete: () => void;
}

export function LinkPanel({ edge, onChangeLabel, onChangeColor, onDelete }: LinkPanelProps) {
  return (
    <div className="panel__body">
      <header className="panel__header hover-actions">
        <input
          className="inline-edit"
          aria-label="Link label"
          placeholder="Label"
          value={typeof edge.label === "string" ? edge.label : ""}
          maxLength={CAMPAIGN_GRAPH_LIMITS.maxLabel}
          onChange={(e) => onChangeLabel(e.target.value)}
        />
        <IconButton icon={Trash2} label="Delete link" danger onClick={onDelete} />
      </header>
      <ColorField label="Colour" value={edge.data?.color ?? null} onChange={onChangeColor} />
    </div>
  );
}
