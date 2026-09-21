import type { Node, NodeProps } from "@xyflow/react";
import { Brain } from "lucide-react";
import { NODE_TYPES } from "../../../shared/nodes/registry";
import type { StatblockData } from "../../../shared/nodes/statblock";
import { BaseCard } from "../BaseCard";
import { NODE_SHAPES } from "../shapes";

export function StatblockCard({ data, selected }: NodeProps<Node<StatblockData>>) {
  const kind = [data.size, data.type, data.subtype && `(${data.subtype})`].filter(Boolean).join(" ");
  const max = data.hitPoints.average;
  // No tracker means the block was never taken into an encounter: full HP, nothing else tracked.
  const current = data.tracker?.currentHp ?? max;
  const temp = data.tracker?.tempHp ?? 0;
  const percent = (value: number) => (max > 0 ? Math.min(100, (value / max) * 100) : 0);
  const conditions = data.tracker?.conditions ?? [];

  return (
    <BaseCard
      title={NODE_TYPES.statblock.titleOf(data)}
      typeLabel="Stat Block"
      shape={NODE_SHAPES.statblock}
      tone="statblock"
      selected={selected}
    >
      <div className="node-card__line">{kind || "Unknown creature"}</div>
      <div className="hp-bar" aria-hidden="true">
        <div className="hp-bar__fill" style={{ width: `${percent(current)}%` }} />
        {temp > 0 && <div className="hp-bar__temp" style={{ width: `${percent(temp)}%` }} />}
      </div>
      <div className="node-card__line">
        {current}
        {temp > 0 && ` (+${temp})`} / {max} HP
      </div>
      <div className="node-card__line">
        AC {data.armorClass.value} · CR {data.challengeRating}
        {data.tracker?.concentrating && <Brain size={12} strokeWidth={2} aria-label="Concentrating" />}
      </div>
      {conditions.length > 0 && (
        <div className="node-card__line">
          {conditions.slice(0, 3).map((c) => (
            <span key={c} className="chip chip--on">
              {c}
            </span>
          ))}
        </div>
      )}
    </BaseCard>
  );
}
