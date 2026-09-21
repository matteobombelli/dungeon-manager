import type { CSSProperties } from "react";
import type { NodeOutline } from "../../shared/graph";
import { previewBox } from "./preview-box";
import { NODE_SHAPES, SHAPE_POLYGONS, SHAPE_SIZES } from "./shapes";

const RADIUS = 12; // --radius
const FRAME_RADIUS = 16;

/** Miniature of a scene's or group's nodes: each drawn as its shape, in its colour, where it sits. */
export function NodePreview({ nodes }: { nodes: readonly NodeOutline[] }) {
  if (nodes.length === 0) return <div className="node-preview node-preview--empty">Empty</div>;
  const box = previewBox(nodes);
  return (
    <svg
      className="node-preview"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${nodes.length} ${nodes.length === 1 ? "node" : "nodes"}`}
    >
      {nodes.map((n) => (
        <Mark key={n.id} node={n} />
      ))}
    </svg>
  );
}

function Mark({ node }: { node: NodeOutline }) {
  const shape = NODE_SHAPES[node.type];
  const { w, h } = SHAPE_SIZES[shape];
  // The type class supplies --tone-default, the inline variable the node's own colour, as on a card.
  const props = {
    className: `node-preview__node node-card--${node.type}`,
    style: node.color ? ({ "--tone-override": node.color } as CSSProperties) : undefined,
    vectorEffect: "non-scaling-stroke" as const,
  };
  const polygon = SHAPE_POLYGONS[shape];
  if (polygon) {
    return <polygon {...props} points={polygon.map(([px, py]) => `${node.x + px * w},${node.y + py * h}`).join(" ")} />;
  }
  if (shape === "circle") return <circle {...props} cx={node.x + w / 2} cy={node.y + h / 2} r={w / 2} />;
  const rx = shape === "pill" ? w / 2 : shape === "frame" ? FRAME_RADIUS : RADIUS;
  return <rect {...props} x={node.x} y={node.y} width={w} height={h} rx={rx} />;
}
