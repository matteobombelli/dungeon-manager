import type { Edge } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { CAMPAIGN_GRAPH_LIMITS } from "../../shared/campaign-graph";
import { IconButton } from "../components/IconButton";

export interface LinkPanelProps {
  edge: Edge;
  onChangeLabel: (label: string) => void;
  onDelete: () => void;
}

export function LinkPanel({ edge, onChangeLabel, onDelete }: LinkPanelProps) {
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
    </div>
  );
}
