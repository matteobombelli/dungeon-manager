import type { Node, NodeProps } from "@xyflow/react";
import type { CustomNodeData } from "../../../shared/nodes/custom";
import { NODE_TYPES } from "../../../shared/nodes/registry";
import { BaseCard } from "../BaseCard";
import { NODE_SHAPES } from "../shapes";

function summarise(data: CustomNodeData, key: string, kind: string): string {
  const value = data.values[key];
  if (kind === "image") return value ? "image attached" : "no image";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function CustomCard({ data, selected }: NodeProps<Node<CustomNodeData>>) {
  return (
    <BaseCard
      title={NODE_TYPES.custom.titleOf(data)}
      typeLabel="Custom"
      shape={NODE_SHAPES.custom}
      tone="custom"
      selected={selected}
    >
      {data.fields.slice(0, 2).map((f) => (
        <div key={f.key} className="node-card__line">
          {f.label}: {summarise(data, f.key, f.kind)}
        </div>
      ))}
    </BaseCard>
  );
}
