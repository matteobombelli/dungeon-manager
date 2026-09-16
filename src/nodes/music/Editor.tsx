import { Pause, Play } from "lucide-react";
import type { MusicData } from "../../../shared/nodes/music";
import { assets } from "../../api/endpoints";
import { useAudioPlayer } from "../../audio/AudioPlayerProvider";
import { AudioField } from "../../components/AudioField";
import { IconButton } from "../../components/IconButton";
import type { NodeEditorProps } from "../types";

export function MusicEditor({ nodeId, data, onChange }: NodeEditorProps<MusicData>) {
  const player = useAudioPlayer();
  const playing = player.playingId === nodeId;
  const set = <K extends keyof MusicData>(key: K, value: MusicData[K]) => onChange({ ...data, [key]: value });

  function setLoop(loop: boolean) {
    set("loop", loop);
    if (playing) player.setLoop(loop);
  }

  function setVolume(volume: number) {
    set("volume", volume);
    if (playing) player.setVolume(volume);
  }

  return (
    <>
      <label>
        Title
        <input value={data.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <AudioField label="Track" assetId={data.assetId} onChange={(id) => set("assetId", id)} />
      <label className="editor-inline">
        <input type="checkbox" checked={data.loop} onChange={(e) => setLoop(e.target.checked)} />
        Loop
      </label>
      <label>
        Volume {Math.round(data.volume * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={data.volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>
      <div className="editor-actions">
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? "Pause" : "Play"}
          disabled={!data.assetId}
          onClick={() =>
            data.assetId && player.toggle(nodeId, assets.url(data.assetId), { loop: data.loop, volume: data.volume })
          }
        />
      </div>
    </>
  );
}
