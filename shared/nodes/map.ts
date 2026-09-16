import { z } from "zod";
import type { NodeTypeDef } from "./registry";

export const MAP_LIMITS = {
  maxCols: 150,
  maxRows: 150,
  minCellSize: 8,
  maxCellSize: 64,
  maxPalette: 32,
  maxStrokeWidth: 32,
  maxTotalPoints: 60000,
} as const;

const Color = z.string().regex(/^#[0-9a-f]{6}$/i);

export const MapPaletteEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: Color,
});
export type MapPaletteEntry = z.infer<typeof MapPaletteEntrySchema>;

export const MapStrokeSchema = z.object({
  color: Color,
  width: z.number().min(1).max(MAP_LIMITS.maxStrokeWidth),
  // Flat [x0, y0, x1, y1, ...] in map pixels.
  points: z
    .array(z.number())
    .min(2)
    .refine((p) => p.length % 2 === 0, { message: "Points must be x/y pairs" }),
});
export type MapStroke = z.infer<typeof MapStrokeSchema>;

export const MapNodeSchema = z
  .object({
    name: z.string(),
    cols: z.int().min(1).max(MAP_LIMITS.maxCols),
    rows: z.int().min(1).max(MAP_LIMITS.maxRows),
    cellSize: z.int().min(MAP_LIMITS.minCellSize).max(MAP_LIMITS.maxCellSize),
    palette: z.array(MapPaletteEntrySchema).max(MAP_LIMITS.maxPalette),
    // cells[i] === 0 is empty; k > 0 refers to palette[k - 1].
    cells: z.array(z.int().min(0)),
    strokes: z.array(MapStrokeSchema),
    backgroundAssetId: z.string().nullable(),
    backgroundOpacity: z.number().min(0).max(1),
  })
  .superRefine((data, ctx) => {
    if (data.cells.length !== data.cols * data.rows) {
      ctx.addIssue({ code: "custom", path: ["cells"], message: "cells.length must equal cols * rows" });
    }
    const max = data.palette.length;
    const bad = data.cells.findIndex((c) => c > max);
    if (bad !== -1) {
      ctx.addIssue({ code: "custom", path: ["cells", bad], message: `Cell value must be <= ${max}` });
    }
    const total = data.strokes.reduce((n, s) => n + s.points.length, 0);
    if (total > MAP_LIMITS.maxTotalPoints) {
      ctx.addIssue({
        code: "custom",
        path: ["strokes"],
        message: `Total stroke points must be <= ${MAP_LIMITS.maxTotalPoints}`,
      });
    }
  });
export type MapNodeData = z.infer<typeof MapNodeSchema>;

export function defaultData(): MapNodeData {
  const cols = 30;
  const rows = 20;
  return {
    name: "",
    cols,
    rows,
    cellSize: 32,
    palette: [
      { id: "stone", name: "Stone", color: "#8a8a8a" },
      { id: "grass", name: "Grass", color: "#5c9e3a" },
      { id: "water", name: "Water", color: "#3b7dd8" },
      { id: "wall", name: "Wall", color: "#3a2f2a" },
    ],
    cells: new Array<number>(cols * rows).fill(0),
    strokes: [],
    backgroundAssetId: null,
    backgroundOpacity: 1,
  };
}

export function titleOf(data: MapNodeData): string {
  return data.name || "Map";
}

export const mapType: NodeTypeDef<MapNodeData> = {
  id: "map",
  label: "Map",
  schema: MapNodeSchema,
  defaultData,
  titleOf,
};
