import { useState, type ComponentType, type CSSProperties } from "react";
import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
import type { Prefab } from "../../shared/api";
import type { CustomNodeData } from "../../shared/nodes/custom";
import { NODE_TYPES, type NodeTypeId } from "../../shared/nodes/registry";
import { prefabs as prefabsApi } from "../api/endpoints";
import { ColorField } from "../components/ColorField";
import { IconButton } from "../components/IconButton";
import { NODE_TYPES_UI, type AppNode } from "../nodes/registry";
import type { NodeEditorProps } from "../nodes/types";
import "../nodes/editor-section.css";

export interface NodePanelProps {
  node: AppNode;
  onChange: (data: Record<string, unknown>) => void;
  onChangeColor: (color: string | null) => void;
  onDelete: () => void;
  onPrefabCreated: (prefab: Prefab) => void;
  onPrefabUpdated: (prefab: Prefab) => void;
}

// Editors and titleOf are typed per node type; the panel only knows the id so it erases the data type here.
function editorFor(type: NodeTypeId): ComponentType<NodeEditorProps<Record<string, unknown>>> {
  return NODE_TYPES_UI[type].Editor as unknown as ComponentType<NodeEditorProps<Record<string, unknown>>>;
}

function titleOf(node: AppNode): string {
  return (NODE_TYPES[node.type].titleOf as (data: Record<string, unknown>) => string)(node.data);
}

export function NodePanel({ node, onChange, onChangeColor, onDelete, onPrefabCreated, onPrefabUpdated }: NodePanelProps) {
  const Editor = editorFor(node.type);
  const [prefabError, setPrefabError] = useState<string | null>(null);
  const custom = node.type === "custom" ? (node.data as CustomNodeData) : null;
  const prefabId = custom?.prefabId ?? null;

  async function saveAsPrefab(data: CustomNodeData) {
    const name = window.prompt("Prefab name", data.prefabName || "");
    if (!name || !name.trim()) return;
    setPrefabError(null);
    try {
      const prefab = await prefabsApi.create({ name: name.trim(), fields: data.fields });
      onChange({ ...data, prefabId: prefab.id, prefabName: prefab.name });
      onPrefabCreated(prefab);
    } catch (err) {
      setPrefabError(err instanceof Error ? err.message : "Could not save prefab");
    }
  }

  async function updatePrefab(data: CustomNodeData, prefabId: string) {
    setPrefabError(null);
    try {
      onPrefabUpdated(await prefabsApi.update(prefabId, { name: data.prefabName, fields: data.fields }));
    } catch (err) {
      setPrefabError(err instanceof Error ? err.message : "Could not update prefab");
    }
  }

  return (
    <div className="panel__body">
      <header
        className={`panel__header hover-actions panel__header--${node.type}`}
        style={node.color ? ({ "--tone": node.color } as CSSProperties) : undefined}
      >
        <span className="panel__title" title={titleOf(node)}>
          {titleOf(node)}
        </span>
        {custom && <IconButton icon={Bookmark} label="Save as prefab" onClick={() => void saveAsPrefab(custom)} />}
        {custom && prefabId && (
          <IconButton icon={BookmarkCheck} label="Update prefab" onClick={() => void updatePrefab(custom, prefabId)} />
        )}
        <IconButton icon={Trash2} label="Delete node" danger onClick={onDelete} />
      </header>
      <ColorField value={node.color} onChange={onChangeColor} />
      {prefabError && <p className="form__error">{prefabError}</p>}
      <Editor key={node.id} nodeId={node.id} data={node.data} onChange={onChange} />
    </div>
  );
}
