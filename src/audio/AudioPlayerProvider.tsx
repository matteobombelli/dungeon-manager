import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface PlayOptions {
  loop: boolean;
  volume: number;
  /** Seconds to ramp up from silence, and back down when paused or replaced; 0 cuts straight in and out. */
  fadeIn: number;
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
  // The volume a fade in is heading for, so the slider can move it mid-fade.
  const targetVolume = useRef(1);
  // The loaded track's fade, which it also fades out over when paused or replaced.
  const loadedFade = useRef(0);
  const fadeFrame = useRef<number | null>(null);

  const stopFade = useCallback(() => {
    if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
    fadeFrame.current = null;
  }, []);

  /**
   * Ramps from the current volume to `to` ("target" follows the slider), then calls `done`. A newer
   * ramp cancels this one along with its `done`, so the last button pressed always wins.
   */
  const ramp = useCallback(
    (el: HTMLAudioElement, to: number | "target", seconds: number, done?: () => void) => {
      stopFade();
      const goal = () => (to === "target" ? targetVolume.current : to);
      if (seconds <= 0) {
        el.volume = goal();
        done?.();
        return;
      }
      const from = el.volume;
      const start = performance.now();
      const step = (time: number) => {
        const progress = Math.min(1, (time - start) / (seconds * 1000));
        el.volume = from + (goal() - from) * progress;
        if (progress < 1) fadeFrame.current = requestAnimationFrame(step);
        else {
          fadeFrame.current = null;
          done?.();
        }
      };
      fadeFrame.current = requestAnimationFrame(step);
    },
    [stopFade],
  );

  // Leaving the campaign unmounts the element; a fade still running would keep scheduling frames.
  useEffect(() => stopFade, [stopFade]);

  const play = useCallback((id: string, url: string, opts: PlayOptions) => {
    const el = elementRef.current;
    if (!el) return;
    // The url is part of the key: a node whose track was replaced must not resume the old file.
    const replacing = loaded.current?.id !== id || loaded.current.url !== url;
    const start = () => {
      if (replacing) {
        loaded.current = { id, url };
        el.src = url;
        setCurrentTime(0);
        setDuration(0);
      }
      el.loop = opts.loop;
      targetVolume.current = opts.volume;
      loadedFade.current = opts.fadeIn;
      // A resume caught mid fade-out ramps back up from where it is rather than dropping to silence.
      if (el.paused && opts.fadeIn > 0) el.volume = 0;
      ramp(el, "target", opts.fadeIn);
      // Autoplay policy or a broken asset rejects; the card must not keep showing "playing".
      el.play().catch(() => setPlayingId((current) => (current === id ? null : current)));
    };
    setPlayingId(id);
    // The track that is sounding fades out over its own fade before the new one starts.
    if (replacing && !el.paused) ramp(el, 0, loadedFade.current, start);
    else start();
  }, [ramp]);

  const pause = useCallback(() => {
    const el = elementRef.current;
    setPlayingId(null);
    if (el) ramp(el, 0, loadedFade.current, () => el.pause());
  }, [ramp]);

  const toggle = useCallback(
    (id: string, url: string, opts: PlayOptions) => {
      if (playingId === id) pause();
      else play(id, url, opts);
    },
    [playingId, pause, play],
  );

  const setVolume = useCallback((volume: number) => {
    targetVolume.current = volume;
    // Mid-fade the ramp picks the new target up on its next frame.
    if (elementRef.current && fadeFrame.current === null) elementRef.current.volume = volume;
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
