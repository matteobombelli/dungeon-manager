import { Trash2 } from "lucide-react";
import { IconButton } from "./IconButton";

export interface MultiSelectPanelProps {
  count: number;
  onDelete: () => void;
}

export function MultiSelectPanel({ count, onDelete }: MultiSelectPanelProps) {
  return (
    <div className="panel__body">
      <header className="panel__header hover-actions">
        <span className="panel__title">{count} selected</span>
        <IconButton icon={Trash2} label="Delete" danger onClick={onDelete} />
      </header>
    </div>
  );
}
