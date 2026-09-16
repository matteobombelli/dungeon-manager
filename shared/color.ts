import { z } from "zod";

export const HexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
/** Per-node fill; null means the node type's default pastel. */
export const NodeColorSchema = HexColorSchema.nullable();
export type NodeColor = z.infer<typeof NodeColorSchema>;

export interface ColorPreset {
  name: string;
  light: string;
  dark: string;
}

/** Swatches offered by the colour picker; light/dark are the same hue tuned per scheme. */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { name: "Sky", light: "#cfe3f7", dark: "#2b3f57" },
  { name: "Mint", light: "#cdeccf", dark: "#2b4a30" },
  { name: "Peach", light: "#fde2b8", dark: "#5a4326" },
  { name: "Rose", light: "#f6c9c9", dark: "#5a2f33" },
  { name: "Lilac", light: "#e3d3f5", dark: "#3f3358" },
  { name: "Lemon", light: "#fff1b8", dark: "#56502a" },
  { name: "Coral", light: "#f6c4b8", dark: "#5c3428" },
  { name: "Sage", light: "#cfe9c4", dark: "#33482a" },
  { name: "Periwinkle", light: "#d3d8f7", dark: "#33395c" },
  { name: "Teal", light: "#cfeee8", dark: "#24504b" },
  { name: "Pink", light: "#f7cbe4", dark: "#56304a" },
  { name: "Slate", light: "#dde1e6", dark: "#3a3f47" },
];
