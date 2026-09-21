import { Trash2 } from "lucide-react";
import { ColorField } from "./ColorField";
import { IconButton } from "./IconButton";

export interface MultiSelectPanelProps {
  count: number;
  /** Shared colour of the selection, or null when mixed. */
  color: string | null;
  onChangeColor: (color: string | null) => void;
  onDelete: () => void;
}

export function MultiSelectPanel({ count, color, onChangeColor, onDelete }: MultiSelectPanelProps) {
  return (
    <div className="panel__body">
      <header className="panel__header hover-actions">
        <span className="panel__title">{count} selected</span>
        <IconButton icon={Trash2} label="Delete" danger onClick={onDelete} />
      </header>
      <ColorField value={color} onChange={onChangeColor} />
    </div>
  );
}
