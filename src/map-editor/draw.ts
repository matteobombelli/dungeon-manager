import type { MapNodeData } from "../../shared/nodes/map";

export interface DrawOptions {
  scale: number;
  image?: HTMLImageElement | null;
  showGrid: boolean;
}

export function mapPixelSize(data: MapNodeData): { width: number; height: number } {
  return { width: data.cols * data.cellSize, height: data.rows * data.cellSize };
}

/** Draws the whole map at `scale` into the top-left of ctx (in ctx's current transform units). */
export function drawMap(ctx: CanvasRenderingContext2D, data: MapNodeData, opts: DrawOptions): void {
  const { width, height } = mapPixelSize(data);
  const { scale, image, showGrid } = opts;

  ctx.save();
  ctx.clearRect(0, 0, width * scale, height * scale);
  ctx.scale(scale, scale);

  if (image && image.naturalWidth > 0) {
    ctx.globalAlpha = data.backgroundOpacity;
    ctx.drawImage(image, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  const size = data.cellSize;
  for (let i = 0; i < data.cells.length; i++) {
    const v = data.cells[i];
    if (v === 0) continue;
    const entry = data.palette[v - 1];
    if (!entry) continue;
    ctx.fillStyle = entry.color;
    ctx.fillRect((i % data.cols) * size, Math.floor(i / data.cols) * size, size, size);
  }

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const stroke of data.strokes) drawStroke(ctx, stroke.color, stroke.width, stroke.points);

  if (showGrid) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 0.5 / scale;
    ctx.beginPath();
    for (let x = 0; x <= data.cols; x++) {
      ctx.moveTo(x * size, 0);
      ctx.lineTo(x * size, height);
    }
    for (let y = 0; y <= data.rows; y++) {
      ctx.moveTo(0, y * size);
      ctx.lineTo(width, y * size);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/** Draws one polyline in map pixels; a single point renders as a dot. Caller sets scale, joins and caps. */
export function drawStroke(ctx: CanvasRenderingContext2D, color: string, width: number, points: number[]): void {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  if (points.length === 2) {
    ctx.beginPath();
    ctx.arc(points[0], points[1], width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.stroke();
}
