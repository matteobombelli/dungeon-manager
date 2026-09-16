import type { EventData } from "../../../shared/nodes/event";
import type { NodeTypeUI } from "../types";
import { EventCard } from "./Card";
import { EventEditor } from "./Editor";

export const eventNodeUI: NodeTypeUI<EventData> = { Card: EventCard, Editor: EventEditor };
