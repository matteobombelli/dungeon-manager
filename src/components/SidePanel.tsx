import { isValidElement, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

export interface SidePanelProps {
  open: boolean;
  children?: ReactNode;
}

const WIDTH_KEY = "dm:panelWidth";
const MIN_WIDTH = 260;
const DEFAULT_WIDTH = 320;
const STACKED = "(max-width: 800px)";

const clampWidth = (w: number) => Math.min(Math.max(w, MIN_WIDTH), window.innerWidth * 0.6);

function storedWidth(): number {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY));
    return w ? clampWidth(w) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

/** Longest transition on the element, so timers follow the stylesheet (and reduced motion) instead of a copied constant. */
export function transitionMs(el: Element): number {
  return Math.max(...getComputedStyle(el).transitionDuration.split(",").map((s) => parseFloat(s) * 1000));
}

/** Keeps `present` true through the exit transition; `moving` is true while either transition runs. */
export function usePresence(open: boolean, el: RefObject<HTMLElement | null>): { present: boolean; moving: boolean } {
  const [present, setPresent] = useState(open);
  const [moving, setMoving] = useState(false);
  if (open && !present) setPresent(true);
  useEffect(() => {
    if (!present) return;
    setMoving(true);
    const timer = setTimeout(
      () => {
        setMoving(false);
        if (!open) setPresent(false);
      },
      el.current ? transitionMs(el.current) : 0
    );
    return () => clearTimeout(timer);
  }, [open, present, el]);
  return { present, moving };
}

/**
 * Resizable side panel that slides in and out. Keyed children re-mount with a fade when the key
 * changes, so callers key their content by the selected element's id.
 */
export function SidePanel({ open, children }: SidePanelProps) {
  const aside = useRef<HTMLElement>(null);
  const { present } = usePresence(open, aside);
  const [width, setWidth] = useState(storedWidth);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ x: number; width: number } | null>(null);
  // The last open content stays rendered while the panel slides out.
  const shown = useRef(children);
  if (open) shown.current = children;

  // Written on drag end, not per pixel; lost pointer capture (an interrupted drag) ends it too.
  function endResize() {
    drag.current = null;
    setResizing(false);
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      /* storage unavailable */
    }
  }

  if (!present) return null;
  const content = shown.current;
  const classes = ["graph-canvas__panel nokey", !open && "graph-canvas__panel--closing", resizing && "graph-canvas__panel--resizing"]
    .filter(Boolean)
    .join(" ");
  return (
    <aside ref={aside} className={classes} style={{ "--panel-width": `${width}px` } as CSSProperties}>
      <div
        className="graph-canvas__panel-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        onPointerDown={(e) => {
          if (window.matchMedia(STACKED).matches) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, width };
          setResizing(true);
        }}
        onPointerMove={(e) => {
          if (drag.current) setWidth(clampWidth(drag.current.width + drag.current.x - e.clientX));
        }}
        onPointerUp={endResize}
        onLostPointerCapture={endResize}
      />
      <div className="graph-canvas__panel-content" key={isValidElement(content) ? content.key : undefined}>
        {content}
      </div>
    </aside>
  );
}
