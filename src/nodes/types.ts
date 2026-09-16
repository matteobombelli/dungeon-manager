import type { ComponentType } from "react";
import type { Node, NodeProps } from "@xyflow/react";

export interface NodeEditorProps<T> {
  nodeId: string;
  data: T;
  onChange: (next: T) => void;
}

export interface NodeTypeUI<T extends Record<string, unknown>> {
  Card: ComponentType<NodeProps<Node<T>>>;
  Editor: ComponentType<NodeEditorProps<T>>;
}
