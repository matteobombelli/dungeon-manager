import { useContext } from "react";
import { FolderOpen } from "lucide-react";
import { GROUP_LIMITS, type GroupData } from "../../../shared/nodes/group";
import type { NodeEditorProps } from "../types";
import { GroupActionsContext } from "./actions";

export function GroupEditor({ nodeId, data, onChange }: NodeEditorProps<GroupData>) {
  const { onOpen } = useContext(GroupActionsContext);

  return (
    <>
      <label>
        Name
        <input
          type="text"
          value={data.name}
          maxLength={GROUP_LIMITS.maxName}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
        />
      </label>
      <button type="button" className="button--primary" onClick={() => onOpen(nodeId)}>
        <FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" /> Open group
      </button>
    </>
  );
}
