import type { Node, NodeProps } from "@xyflow/react";
import { Pause, Play, Repeat } from "lucide-react";
import type { MusicData } from "../../../shared/nodes/music";
import { NODE_TYPES } from "../../../shared/nodes/registry";
import { assets } from "../../api/endpoints";
import { useAudioPlayer } from "../../audio/AudioPlayerProvider";
import { IconButton } from "../../components/IconButton";
import { BaseCard } from "../BaseCard";
import { NODE_SHAPES } from "../shapes";

export function MusicCard({ id, data, selected }: NodeProps<Node<MusicData>>) {
  const player = useAudioPlayer();
  const playing = player.playingId === id;
  const { assetId } = data;

  let line = "no audio";
  if (playing) line = `${formatTime(player.currentTime)} / ${formatTime(player.duration)}`;
  else if (assetId) line = "ready";

  return (
    <BaseCard
      title={NODE_TYPES.music.titleOf(data)}
      typeLabel="Music"
      shape={NODE_SHAPES.music}
      tone="music"
      selected={selected}
    >
      <div className="nodrag nopan">
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? "Pause" : "Play"}
          disabled={!assetId}
          onClick={() =>
            assetId && player.toggle(id, assets.url(assetId), { loop: data.loop, volume: data.volume })
          }
        />
      </div>
      <div className="node-card__line">{line}</div>
      {data.loop && <Repeat size={14} strokeWidth={1.75} role="img" aria-label="Loops" />}
    </BaseCard>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
