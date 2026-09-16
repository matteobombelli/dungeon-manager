import type { CustomNodeData } from "../../../shared/nodes/custom";
import type { NodeTypeUI } from "../types";
import { CustomCard } from "./Card";
import { CustomEditor } from "./Editor";

export const customNodeUI: NodeTypeUI<CustomNodeData> = { Card: CustomCard, Editor: CustomEditor };
