import type { Node, NodeProps } from "@xyflow/react";
import type { EventData } from "../../../shared/nodes/event";
import { NODE_TYPES } from "../../../shared/nodes/registry";
import { BaseCard } from "../BaseCard";
import { NODE_SHAPES } from "../shapes";

export function EventCard({ data, selected }: NodeProps<Node<EventData>>) {
  const n = data.checks.length;
  return (
    <BaseCard
      title={NODE_TYPES.event.titleOf(data)}
      typeLabel="Event"
      shape={NODE_SHAPES.event}
      tone="event"
      selected={selected}
    >
      <div className="node-card__line">
        {n} {n === 1 ? "check" : "checks"}
      </div>
    </BaseCard>
  );
}
