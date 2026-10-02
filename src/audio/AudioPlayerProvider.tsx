import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface PlayOptions {
  loop: boolean;
  volume: number;
  /** Seconds to ramp up from silence, and back down when paused or crossfaded out; 0 cuts straight in and out. */
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

// One of the two players a crossfade needs: the outgoing track fades out on one while the incoming
// track fades in on the other.
interface Deck {
  el: HTMLAudioElement | null;
  loaded: { id: string; url: string } | null;
  /** The loaded track's fade, which it also fades out over when paused or replaced. */
  fade: number;
  /** The volume a fade in is heading for, so the slider can move it mid-fade. */
  target: number;
  frame: number | null;
}

const newDeck = (): Deck => ({ el: null, loaded: null, fade: 0, target: 1, frame: null });

function stopFade(deck: Deck) {
  if (deck.frame !== null) cancelAnimationFrame(deck.frame);
  deck.frame = null;
}

/**
 * Ramps a deck from its current volume to `to` ("target" follows the slider), then calls `done`. A
 * newer ramp on the same deck cancels this one along with its `done`, so the last button pressed wins.
 */
function ramp(deck: Deck, to: number | "target", seconds: number, done?: () => void) {
  const el = deck.el;
  if (!el) return;
  stopFade(deck);
  const goal = () => (to === "target" ? deck.target : to);
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
    if (progress < 1) deck.frame = requestAnimationFrame(step);
    else {
      deck.frame = null;
      done?.();
    }
  };
  deck.frame = requestAnimationFrame(step);
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  // Two elements for the whole workspace: playback survives cards unmounting as the canvas pans
  // and panels open, and one track is the active one while another may still be fading out.
  const decks = useRef<[Deck, Deck]>([newDeck(), newDeck()]);
  const activeIndex = useRef(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const active = () => decks.current[activeIndex.current];
  const isActive = (el: HTMLAudioElement) => active().el === el;

  // Leaving the campaign unmounts the elements; a fade still running would keep scheduling frames.
  useEffect(() => () => decks.current.forEach(stopFade), []);

  const play = useCallback((id: string, url: string, opts: PlayOptions) => {
    const current = decks.current[activeIndex.current];
    // The url is part of the key: a node whose track was replaced must not resume the old file.
    const holds = (deck: Deck) => deck.loaded?.id === id && deck.loaded.url === url;
    let deck = current;
    if (!holds(current)) {
      // Crossfade: the sounding track fades out over its own fade while the new one fades in on the
      // other deck. Switching back mid-fade finds the track still loaded there and ramps it back up.
      activeIndex.current = 1 - activeIndex.current;
      deck = decks.current[activeIndex.current];
      if (current.el && !current.el.paused) {
        const el = current.el;
        ramp(current, 0, current.fade, () => el.pause());
      }
      if (!holds(deck) && deck.el) {
        stopFade(deck);
        deck.loaded = { id, url };
        deck.el.src = url;
      }
      setCurrentTime(deck.el?.currentTime ?? 0);
      setDuration(deck.el && Number.isFinite(deck.el.duration) ? deck.el.duration : 0);
    }
    const el = deck.el;
    if (!el) return;
    el.loop = opts.loop;
    deck.target = opts.volume;
    deck.fade = opts.fadeIn;
    // A track caught mid fade-out ramps back up from where it is rather than dropping to silence.
    if (el.paused && opts.fadeIn > 0) el.volume = 0;
    ramp(deck, "target", opts.fadeIn);
    setPlayingId(id);
    // Autoplay policy or a broken asset rejects; the card must not keep showing "playing".
    el.play().catch(() => setPlayingId((playing) => (playing === id ? null : playing)));
  }, []);

  const pause = useCallback(() => {
    const deck = decks.current[activeIndex.current];
    setPlayingId(null);
    const el = deck.el;
    if (el) ramp(deck, 0, deck.fade, () => el.pause());
  }, []);

  const toggle = useCallback(
    (id: string, url: string, opts: PlayOptions) => {
      if (playingId === id) pause();
      else play(id, url, opts);
    },
    [playingId, pause, play],
  );

  const setVolume = useCallback((volume: number) => {
    const deck = decks.current[activeIndex.current];
    deck.target = volume;
    // Mid-fade the ramp picks the new target up on its next frame.
    if (deck.el && deck.frame === null) deck.el.volume = volume;
  }, []);

  const setLoop = useCallback((loop: boolean) => {
    const el = decks.current[activeIndex.current].el;
    if (el) el.loop = loop;
  }, []);

  const value = useMemo<AudioPlayer>(
    () => ({ playingId, currentTime, duration, play, pause, toggle, setVolume, setLoop }),
    [playingId, currentTime, duration, play, pause, toggle, setVolume, setLoop],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {/* No controls: the music cards and the node editor drive them. Only the active deck reports;
          `ended` does not fire while looping, so a looping track keeps its playingId. */}
      {decks.current.map((deck, i) => (
        <audio
          key={i}
          ref={(el) => {
            deck.el = el;
          }}
          onTimeUpdate={(e) => isActive(e.currentTarget) && setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => isActive(e.currentTarget) && setDuration(e.currentTarget.duration)}
          onEnded={(e) => isActive(e.currentTarget) && setPlayingId(null)}
        />
      ))}
      {children}
    </AudioPlayerContext.Provider>
  );
}

/** Outside a provider every call is a no-op, so cards render in the add-menu and in tests. */
export function useAudioPlayer(): AudioPlayer {
  return useContext(AudioPlayerContext);
}
