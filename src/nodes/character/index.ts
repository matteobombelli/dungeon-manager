import type { CharacterData } from "../../../shared/nodes/character";
import type { NodeTypeUI } from "../types";
import { CharacterCard } from "./Card";
import { CharacterEditor } from "./Editor";

export const characterNodeUI: NodeTypeUI<CharacterData> = { Card: CharacterCard, Editor: CharacterEditor };
