import type { Node, NodeProps } from "@xyflow/react";
import type { GroupData } from "../../../shared/nodes/group";
import { NODE_TYPES } from "../../../shared/nodes/registry";
import { BaseCard } from "../BaseCard";
import { NodePreview } from "../NodePreview";
import { NODE_SHAPES } from "../shapes";

export function GroupCard({ data, selected }: NodeProps<Node<GroupData>>) {
  return (
    <BaseCard title={NODE_TYPES.group.titleOf(data)} typeLabel="Group" shape={NODE_SHAPES.group} tone="group" selected={selected}>
      <NodePreview nodes={data.nodes} />
    </BaseCard>
  );
}
