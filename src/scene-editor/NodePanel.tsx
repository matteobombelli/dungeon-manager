import type { ComponentType, CSSProperties } from "react";
import { Trash2 } from "lucide-react";
import { NODE_TYPES, type NodeTypeId } from "../../shared/nodes/registry";
import { ColorField } from "../components/ColorField";
import { IconButton } from "../components/IconButton";
import { NODE_TYPES_UI, type AppNode } from "../nodes/registry";
import { NodeIdContext, type NodeEditorProps } from "../nodes/types";
import "../nodes/editor-section.css";

export interface NodePanelProps {
  node: AppNode;
  onChange: (data: Record<string, unknown>) => void;
  onChangeColor: (color: string | null) => void;
  onDelete: () => void;
  /** Forwarded to the editor; the map editor opens its modal on it. */
  openRequest?: number;
}

// Editors and titleOf are typed per node type; the panel only knows the id so it erases the data type here.
function editorFor(type: NodeTypeId): ComponentType<NodeEditorProps<Record<string, unknown>>> {
  return NODE_TYPES_UI[type].Editor as unknown as ComponentType<NodeEditorProps<Record<string, unknown>>>;
}

function titleOf(node: AppNode): string {
  return (NODE_TYPES[node.type].titleOf as (data: Record<string, unknown>) => string)(node.data);
}

export function NodePanel({ node, onChange, onChangeColor, onDelete, openRequest }: NodePanelProps) {
  const Editor = editorFor(node.type);

  return (
    <div className="panel__body">
      <header
        className={`panel__header hover-actions panel__header--${node.type}`}
        style={node.color ? ({ "--tone": node.color } as CSSProperties) : undefined}
      >
        <span className="panel__title" title={titleOf(node)}>
          {titleOf(node)}
        </span>
        <IconButton icon={Trash2} label="Delete node" danger onClick={onDelete} />
      </header>
      <ColorField value={node.color} onChange={onChangeColor} />
      <NodeIdContext.Provider value={node.id}>
        <Editor key={node.id} nodeId={node.id} data={node.data} onChange={onChange} openRequest={openRequest} />
      </NodeIdContext.Provider>
    </div>
  );
}
