import type { Edge } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { GRAPH_LIMITS } from "../../shared/graph";
import { IconButton } from "../components/IconButton";

export interface EdgePanelProps {
  edge: Edge;
  onChangeLabel: (label: string) => void;
  onDelete: () => void;
}

export function EdgePanel({ edge, onChangeLabel, onDelete }: EdgePanelProps) {
  return (
    <div className="panel__body">
      <header className="panel__header hover-actions">
        <input
          className="inline-edit"
          aria-label="Label"
          placeholder="Label"
          value={typeof edge.label === "string" ? edge.label : ""}
          maxLength={GRAPH_LIMITS.maxLabel}
          onChange={(e) => onChangeLabel(e.target.value)}
        />
        <IconButton icon={Trash2} label="Delete edge" danger onClick={onDelete} />
      </header>
    </div>
  );
}
