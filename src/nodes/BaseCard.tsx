import type { ReactNode } from "react";
import { Handle, Position, useNodeId, useUpdateNodeInternals } from "@xyflow/react";
import type { NodeShape } from "./shapes";
import "./nodes.css";

export interface BaseCardProps {
  title: string;
  /** Read by screen readers only; the shape and colour carry the type visually. */
  typeLabel?: string;
  shape: NodeShape;
  /** CSS class suffix: scene | map | event | statblock | character | custom. */
  tone: string;
  selected?: boolean;
  children?: ReactNode;
  /** Icon buttons revealed on hover in the card's corner. */
  actions?: ReactNode;
}

export function BaseCard({ title, typeLabel, shape, tone, selected, children, actions }: BaseCardProps) {
  const classes = ["node-card", `node-card--${shape}`, `node-card--${tone}`, selected && "node-card--selected"]
    .filter(Boolean)
    .join(" ");
  // React Flow measures handles while the mount animation is still scaling the card; re-measure once it ends.
  // Outside a canvas (add-menu glyphs) there is no node id and nothing to update.
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  return (
    <div
      className={classes}
      onAnimationEnd={(e) => {
        if (e.animationName === "node-pop" && nodeId) updateNodeInternals(nodeId);
      }}
    >
      <Handle type="target" position={Position.Left} className="node-card__handle" />
      <header className="node-card__header">
        {typeLabel && <span className="sr-only">{typeLabel}: </span>}
        <span className="node-card__title" title={title}>
          {title}
        </span>
      </header>
      {children && <div className="node-card__body">{children}</div>}
      {actions && <div className="node-card__actions hover-actions nodrag">{actions}</div>}
      <Handle type="source" position={Position.Right} className="node-card__handle" />
    </div>
  );
}
