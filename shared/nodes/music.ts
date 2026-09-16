import { z } from "zod";
import type { NodeTypeDef } from "./registry";

export const MusicSchema = z.object({
  title: z.string(),
  // Uploaded audio asset (POST /assets with an audio/* type); null until a file is attached.
  assetId: z.string().nullable(),
  loop: z.boolean(),
  volume: z.number().min(0).max(1),
});
export type MusicData = z.infer<typeof MusicSchema>;

export function defaultData(): MusicData {
  return { title: "", assetId: null, loop: false, volume: 0.8 };
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
