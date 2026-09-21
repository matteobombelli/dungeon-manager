import { createContext, type ComponentType } from "react";
import type { Node, NodeProps } from "@xyflow/react";

export interface NodeEditorProps<T> {
  nodeId: string;
  data: T;
  onChange: (next: T) => void;
  /**
   * Bumped when the canvas asks this node's editor to open its modal (a double-click on the card).
   * A counter rather than a flag, so asking twice in a row fires twice; 0 means nothing was asked.
   */
  openRequest?: number;
}

export interface NodeTypeUI<T extends Record<string, unknown>> {
  Card: ComponentType<NodeProps<Node<T>>>;
  Editor: ComponentType<NodeEditorProps<T>>;
}

/** Id of the node whose editor is mounted; sections key their collapsed state on it. */
export const NodeIdContext = createContext<string>("");
