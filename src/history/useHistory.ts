import { useCallback, useEffect, useRef, useState, type DependencyList, type RefObject } from "react";
import { isInputDOMNode } from "@xyflow/system";

export interface HistoryOptions<T> {
  /** Values whose change means the document may have changed. */
  inputs: DependencyList;
  snapshot: () => T;
  /** While any of these is true the document is in motion and is not recorded. */
  holds: RefObject<boolean>[];
  /** Puts a recorded document back; the inputs must then snapshot to exactly that document. */
  restore: (doc: T) => void;
  /** Keyboard shortcuts (ctrl/cmd + Z, shift + Z or Y) are only taken while true. */
  enabled: boolean;
}

export interface History {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const MAX_ENTRIES = 50;
/** Changes this close together (typing, a run of edits) undo as one step. */
const COALESCE_MS = 1000;
const HOLD_RECHECK_MS = 250;

/**
 * Undo and redo over a document's cold states. The document is compared as JSON, so a change of
 * selection or of anything else outside the snapshot is not a step.
 */
export function useHistory<T>({ inputs, snapshot, holds, restore, enabled }: HistoryOptions<T>): History {
  const opts = useRef({ snapshot, holds, restore });
  opts.current = { snapshot, holds, restore };
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const present = useRef<string | null>(null);
  const lastRecorded = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const isHot = () => opts.current.holds.some((h) => h.current);

  function sync() {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  }

  /** Records the current document as a new step when it differs from the last recorded one. */
  function record() {
    const json = JSON.stringify(opts.current.snapshot());
    if (present.current === null) {
      present.current = json;
      return;
    }
    if (json === present.current) return;
    const now = Date.now();
    if (now - lastRecorded.current > COALESCE_MS) {
      past.current.push(present.current);
      if (past.current.length > MAX_ENTRIES) past.current.shift();
    }
    lastRecorded.current = now;
    present.current = json;
    future.current = [];
    sync();
  }

  function recordWhenCold() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (isHot()) {
      timer.current = setTimeout(recordWhenCold, HOLD_RECHECK_MS);
      return;
    }
    record();
  }

  useEffect(recordWhenCold, inputs);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const step = useCallback((from: string[], to: string[]) => {
    if (isHot()) return;
    record();
    const target = from.pop();
    if (target === undefined || present.current === null) return;
    to.push(present.current);
    present.current = target;
    // Not a coalescable edit: the next change after an undo must be its own step.
    lastRecorded.current = 0;
    sync();
    opts.current.restore(JSON.parse(target) as T);
  }, []);

  const undo = useCallback(() => step(past.current, future.current), [step]);
  const redo = useCallback(() => step(future.current, past.current), [step]);

  // Inputs keep their own undo; dialogs keep their keys.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isInputDOMNode(e) || document.querySelector('[role="dialog"]')) return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) undo();
      else if ((key === "z" && e.shiftKey) || key === "y") redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, undo, redo]);

  return { canUndo, canRedo, undo, redo };
}
