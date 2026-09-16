import type { Node, NodeProps } from "@xyflow/react";
import { NODE_TYPES } from "../../../shared/nodes/registry";
import type { StatblockData } from "../../../shared/nodes/statblock";
import { BaseCard } from "../BaseCard";
import { NODE_SHAPES } from "../shapes";

export function StatblockCard({ data, selected }: NodeProps<Node<StatblockData>>) {
  const kind = [data.size, data.type, data.subtype && `(${data.subtype})`].filter(Boolean).join(" ");
  return (
    <BaseCard
      title={NODE_TYPES.statblock.titleOf(data)}
      typeLabel="Stat Block"
      shape={NODE_SHAPES.statblock}
      tone="statblock"
      selected={selected}
    >
      <div className="node-card__line">{kind || "Unknown creature"}</div>
      <div className="node-card__line">
        AC {data.armorClass.value} · HP {data.hitPoints.average} · CR {data.challengeRating}
      </div>
    </BaseCard>
  );
}
