import type { z } from "zod";
import { customType, type CustomNodeData } from "./custom";
import { mapType, type MapNodeData } from "./map";
import { statblockType, type StatblockData } from "./statblock";
import { characterType, type CharacterData } from "./character";
import { eventType, type EventData } from "./event";
import { musicType, type MusicData } from "./music";

export const NODE_TYPE_IDS = ["custom", "map", "statblock", "character", "event", "music"] as const;
export type NodeTypeId = (typeof NODE_TYPE_IDS)[number];

export interface NodeTypeDef<T> {
  id: NodeTypeId;
  label: string;
  schema: z.ZodType<T>;
  defaultData: () => T;
  titleOf: (data: T) => string;
}

export const NODE_TYPES: {
  custom: NodeTypeDef<CustomNodeData>;
  map: NodeTypeDef<MapNodeData>;
  statblock: NodeTypeDef<StatblockData>;
  character: NodeTypeDef<CharacterData>;
  event: NodeTypeDef<EventData>;
  music: NodeTypeDef<MusicData>;
} = {
  custom: customType,
  map: mapType,
  statblock: statblockType,
  character: characterType,
  event: eventType,
  music: musicType,
};

export type NodeDataOf<K extends NodeTypeId> = (typeof NODE_TYPES)[K] extends NodeTypeDef<infer T> ? T : never;

export function isNodeTypeId(s: string): s is NodeTypeId {
  return (NODE_TYPE_IDS as readonly string[]).includes(s);
}
