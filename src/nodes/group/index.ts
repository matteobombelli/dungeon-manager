import type { GroupData } from "../../../shared/nodes/group";
import type { NodeTypeUI } from "../types";
import { GroupCard } from "./Card";
import { GroupEditor } from "./Editor";

export const groupNodeUI: NodeTypeUI<GroupData> = { Card: GroupCard, Editor: GroupEditor };
