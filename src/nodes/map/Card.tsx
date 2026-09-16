import { useEffect, useRef } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { MapNodeData } from "../../../shared/nodes/map";
import { NODE_TYPES } from "../../../shared/nodes/registry";
import { drawMap } from "../../map-editor/draw";
import { BaseCard } from "../BaseCard";
import { NODE_SHAPES } from "../shapes";

const THUMB_WIDTH = 200;

export function MapCard({ data, selected }: NodeProps<Node<MapNodeData>>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = THUMB_WIDTH / (data.cols * data.cellSize);
  const height = Math.max(1, Math.round(data.rows * data.cellSize * scale));

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawMap(ctx, data, { scale, showGrid: false });
  }, [data, scale]);

  return (
    <BaseCard
      title={NODE_TYPES.map.titleOf(data)}
      typeLabel="Map"
      shape={NODE_SHAPES.map}
      tone="map"
      selected={selected}
    >
      <canvas ref={canvasRef} className="map-node__thumb" width={THUMB_WIDTH} height={height} />
      <div className="node-card__line">
        {data.cols} × {data.rows}
        {data.backgroundAssetId && " · bg"}
      </div>
    </BaseCard>
  );
}
