import { Redo2, Undo2 } from "lucide-react";
import type { History } from "../history/useHistory";
import { IconButton } from "./IconButton";

export function HistoryButtons({ canUndo, canRedo, undo, redo }: History) {
  return (
    <>
      <IconButton icon={Undo2} label="Undo" disabled={!canUndo} onClick={undo} />
      <IconButton icon={Redo2} label="Redo" disabled={!canRedo} onClick={redo} />
    </>
  );
}
