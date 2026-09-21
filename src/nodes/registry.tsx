import type { Node, NodeTypes } from "@xyflow/react";
import type { NodeDataOf, NodeTypeId } from "../../shared/nodes/registry";
import type { NodeTypeUI } from "./types";
import { customNodeUI } from "./custom";
import { characterNodeUI } from "./character";
import { eventNodeUI } from "./event";
import { mapNodeUI } from "./map";
import { musicNodeUI } from "./music";
import { groupNodeUI } from "./group";
import { statblockNodeUI } from "./statblock";
import "./nodes.css";

// Extract keeps the generic K provably an object type without changing what each entry resolves to.
export const NODE_TYPES_UI: { [K in NodeTypeId]: NodeTypeUI<Extract<NodeDataOf<K>, Record<string, unknown>>> } = {
  custom: customNodeUI,
  map: mapNodeUI,
  statblock: statblockNodeUI,
  character: characterNodeUI,
  event: eventNodeUI,
  music: musicNodeUI,
  group: groupNodeUI,
};

// `color` is persisted per node (GraphNodeSchema); withColor() mirrors it onto `style` for the card.
export type AppNode = Node<Record<string, unknown>, NodeTypeId> & { color: string | null };

// Module-level so React Flow does not see a new object on each render.
export const nodeTypes: NodeTypes = {
  custom: NODE_TYPES_UI.custom.Card,
  map: NODE_TYPES_UI.map.Card,
  statblock: NODE_TYPES_UI.statblock.Card,
  character: NODE_TYPES_UI.character.Card,
  event: NODE_TYPES_UI.event.Card,
  music: NODE_TYPES_UI.music.Card,
  group: NODE_TYPES_UI.group.Card,
};
