export type Tool = "paint" | "fill" | "pen" | "erase";
export type EraseMode = "cells" | "strokes";

export const ZOOM_LEVELS = [0.5, 1, 2] as const;
export const MAX_BRUSH_SIZE = 9;

export interface ToolState {
  tool: Tool;
  /** 0-based index into palette; the painted cell value is paletteIndex + 1. */
  paletteIndex: number;
  /** Side length in cells of the square painted or cell-erased per pointer position. */
  brushSize: number;
  penColor: string;
  penWidth: number;
  eraseMode: EraseMode;
  zoom: number;
}

export const DEFAULT_TOOL_STATE: ToolState = {
  tool: "paint",
  paletteIndex: 0,
  brushSize: 1,
  penColor: "#d94040",
  penWidth: 4,
  eraseMode: "cells",
  zoom: 1,
};

/** Side length in cells of the outline shown under the cursor; 0 when the tool works on strokes. */
export function brushOutlineSize(tools: ToolState): number {
  if (tools.tool === "paint" || (tools.tool === "erase" && tools.eraseMode === "cells")) return tools.brushSize;
  return tools.tool === "fill" ? 1 : 0;
}
