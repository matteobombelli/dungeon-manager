export type Tool = "paint" | "pen" | "erase";
export type EraseMode = "cells" | "strokes";

export const ZOOM_LEVELS = [0.5, 1, 2] as const;

export interface ToolState {
  tool: Tool;
  /** 0-based index into palette; the painted cell value is paletteIndex + 1. */
  paletteIndex: number;
  penColor: string;
  penWidth: number;
  eraseMode: EraseMode;
  zoom: number;
}

export const DEFAULT_TOOL_STATE: ToolState = {
  tool: "paint",
  paletteIndex: 0,
  penColor: "#d94040",
  penWidth: 4,
  eraseMode: "cells",
  zoom: 1,
};
