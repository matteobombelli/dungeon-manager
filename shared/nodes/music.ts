import { z } from "zod";
import type { NodeTypeDef } from "./registry";

export const FADE_IN_MAX = 60;

export const MusicSchema = z.object({
  title: z.string(),
  // Uploaded audio asset (POST /assets with an audio/* type); null until a file is attached.
  assetId: z.string().nullable(),
  loop: z.boolean(),
  volume: z.number().min(0).max(1),
  // Seconds to fade in from silence each time play is pressed, and to fade out when paused or when
  // another music node takes over; 0 cuts straight in and out.
  // Defaulted so nodes saved before the field existed still parse.
  fadeIn: z.number().min(0).max(FADE_IN_MAX).default(0),
});
export type MusicData = z.infer<typeof MusicSchema>;

export function defaultData(): MusicData {
  return { title: "", assetId: null, loop: true, volume: 0.6, fadeIn: 3 };
}

export function titleOf(data: MusicData): string {
  return data.title || "Music";
}

export const musicType: NodeTypeDef<MusicData> = {
  id: "music",
  label: "Music",
  schema: MusicSchema,
  defaultData,
  titleOf,
};
