import type { Node, NodeProps } from "@xyflow/react";
import type { CharacterData } from "../../../shared/nodes/character";
import { NODE_TYPES } from "../../../shared/nodes/registry";
import { assets } from "../../api/endpoints";
import { BaseCard } from "../BaseCard";
import { NODE_SHAPES } from "../shapes";

export function CharacterCard({ data, selected }: NodeProps<Node<CharacterData>>) {
  const line = [data.race, data.class].filter(Boolean).join(" ");
  return (
    <BaseCard
      title={NODE_TYPES.character.titleOf(data)}
      typeLabel="Character"
      shape={NODE_SHAPES.character}
      tone="character"
      selected={selected}
    >
      {data.portraitAssetId && <img className="node-card__portrait" src={assets.url(data.portraitAssetId)} alt="" />}
      <div className="node-card__line">
        {line || "Unknown"} · Lv {data.level}
      </div>
      <div>
        <span className={`node-card__tag${data.isPlayer ? "" : " node-card__tag--muted"}`}>
          {data.isPlayer ? "Player" : "NPC"}
        </span>
      </div>
    </BaseCard>
  );
}
