import type { StatblockData } from "../../../shared/nodes/statblock";
import type { NodeTypeUI } from "../types";
import { StatblockCard } from "./Card";
import { StatblockEditor } from "./Editor";
import "./statblock.css";

export const statblockNodeUI: NodeTypeUI<StatblockData> = { Card: StatblockCard, Editor: StatblockEditor };
