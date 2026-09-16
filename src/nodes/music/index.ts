import type { MusicData } from "../../../shared/nodes/music";
import type { NodeTypeUI } from "../types";
import { MusicCard } from "./Card";
import { MusicEditor } from "./Editor";

export const musicNodeUI: NodeTypeUI<MusicData> = { Card: MusicCard, Editor: MusicEditor };
