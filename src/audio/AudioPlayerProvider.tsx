import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface PlayOptions {
  loop: boolean;
  volume: number;
}

export interface AudioPlayer {
  /** Node id whose track is playing, or null. */
  playingId: string | null;
  currentTime: number;
  duration: number;
  play: (id: string, url: string, opts: PlayOptions) => void;
  pause: () => void;
  toggle: (id: string, url: string, opts: PlayOptions) => void;
  setVolume: (volume: number) => void;
  setLoop: (loop: boolean) => void;
}

const SILENT: AudioPlayer = {
  playingId: null,
  currentTime: 0,
  duration: 0,
  play: () => {},
  pause: () => {},
  toggle: () => {},
  setVolume: () => {},
  setLoop: () => {},
};

const AudioPlayerContext = createContext<AudioPlayer>(SILENT);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  // One element for the whole workspace: playback survives cards unmounting as the canvas pans
  // and panels open, and only one track can sound at a time.
  const elementRef = useRef<HTMLAudioElement>(null);
  const loaded = useRef<{ id: string; url: string } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const play = useCallback((id: string, url: string, opts: PlayOptions) => {
    const el = elementRef.current;
    if (!el) return;
    // The url is part of the key: a node whose track was replaced must not resume the old file.
    if (loaded.current?.id !== id || loaded.current.url !== url) {
      loaded.current = { id, url };
      el.src = url;
      setCurrentTime(0);
      setDuration(0);
    }
    el.loop = opts.loop;
    el.volume = opts.volume;
    setPlayingId(id);
    // Autoplay policy or a broken asset rejects; the card must not keep showing "playing".
    el.play().catch(() => setPlayingId((current) => (current === id ? null : current)));
  }, []);

  const pause = useCallback(() => {
    elementRef.current?.pause();
    setPlayingId(null);
  }, []);

  const toggle = useCallback(
    (id: string, url: string, opts: PlayOptions) => {
      if (playingId === id) pause();
      else play(id, url, opts);
    },
    [playingId, pause, play],
  );

  const setVolume = useCallback((volume: number) => {
    if (elementRef.current) elementRef.current.volume = volume;
  }, []);

  const setLoop = useCallback((loop: boolean) => {
    if (elementRef.current) elementRef.current.loop = loop;
  }, []);

  const value = useMemo<AudioPlayer>(
    () => ({ playingId, currentTime, duration, play, pause, toggle, setVolume, setLoop }),
    [playingId, currentTime, duration, play, pause, toggle, setVolume, setLoop],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {/* No controls: the music cards and the node editor drive it. `ended` does not fire while
          looping, so a looping track keeps its playingId. */}
      <audio
        ref={elementRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlayingId(null)}
      />
      {children}
    </AudioPlayerContext.Provider>
  );
}

/** Outside a provider every call is a no-op, so cards render in the add-menu and in tests. */
export function useAudioPlayer(): AudioPlayer {
  return useContext(AudioPlayerContext);
}
