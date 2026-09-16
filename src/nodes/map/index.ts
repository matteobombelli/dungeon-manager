import type { MapNodeData } from "../../../shared/nodes/map";
import type { NodeTypeUI } from "../types";
import { MapCard } from "./Card";
import { MapEditor } from "./Editor";
import "./map-node.css";

export const mapNodeUI: NodeTypeUI<MapNodeData> = {
  Card: MapCard,
  Editor: MapEditor,
};
