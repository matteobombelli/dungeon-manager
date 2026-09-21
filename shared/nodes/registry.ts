import type { z } from "zod";
import { customType, type CustomNodeData } from "./custom";
import { mapType, type MapNodeData } from "./map";
import { statblockType, type StatblockData } from "./statblock";
import { characterType, type CharacterData } from "./character";
import { eventType, type EventData } from "./event";
import { musicType, type MusicData } from "./music";
import { groupType, type GroupData } from "./group";
import type { NodeTypeId } from "./ids";

export { NODE_TYPE_IDS, GROUP_CHILD_TYPE_IDS, isNodeTypeId } from "./ids";
export type { NodeTypeId, GroupChildTypeId } from "./ids";

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
  group: NodeTypeDef<GroupData>;
} = {
  custom: customType,
  map: mapType,
  statblock: statblockType,
  character: characterType,
  event: eventType,
  music: musicType,
  group: groupType,
};

export type NodeDataOf<K extends NodeTypeId> = (typeof NODE_TYPES)[K] extends NodeTypeDef<infer T> ? T : never;
