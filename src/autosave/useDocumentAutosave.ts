import { useEffect, useRef, useState, type DependencyList, type RefObject } from "react";
import type { ZodType } from "zod";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface DocumentAutosaveOptions<T> {
  /** Identity of the document; changing it resets the saved baseline. */
  key: string;
  /** Values whose change means the document may have changed. */
  inputs: DependencyList;
  snapshot: () => T;
  schema: ZodType;
  save: (doc: T) => Promise<unknown>;
  /** PUT target for the unmount flush. */
  flushUrl: string;
  /** While any of these is true the document is in motion and is not snapshotted. */
  holds: RefObject<boolean>[];
}

const DEBOUNCE_MS = 1500;
const HOLD_RECHECK_MS = 500;
const RETRY_MS = 5000;

export function useDocumentAutosave<T>({
  key,
  inputs,
  snapshot,
  schema,
  save,
  flushUrl,
  holds,
}: DocumentAutosaveOptions<T>): { status: SaveStatus; error: string | null } {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // The save loop runs from timers, so everything it reads lives in refs.
  const opts = useRef({ snapshot, schema, save, holds });
  opts.current = { snapshot, schema, save, holds };
  const latest = useRef<{ json: string; doc: T } | null>(null);
  const lastSaved = useRef<string | null>(null);
  const hasSaved = useRef(false);
  const needsSnapshot = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHot = () => opts.current.holds.some((h) => h.current);

  function takeSnapshot() {
    const doc = opts.current.snapshot();
    latest.current = { json: JSON.stringify(doc), doc };
    needsSnapshot.current = false;
  }

  function isDirty() {
    if (needsSnapshot.current) takeSnapshot();
    return latest.current !== null && latest.current.json !== lastSaved.current;
  }

  function schedule(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(attempt, ms);
  }

  async function attempt() {
    timer.current = null;
    if (isHot()) {
      schedule(HOLD_RECHECK_MS);
      return;
    }
    if (needsSnapshot.current) {
      // Just went cold: snapshot now, then give the settled document the usual debounce.
      if (isDirty()) schedule(DEBOUNCE_MS);
      else setStatus(hasSaved.current ? "saved" : "idle");
      return;
    }
    if (!isDirty()) return;
    if (saving.current) return; // the in-flight save reschedules when it finishes
    const current = latest.current!;
    const parsed = opts.current.schema.safeParse(current.doc);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(`${issue.path.join(".")}: ${issue.message}`);
      setStatus("error");
      return; // nothing to retry until the inputs change
    }
    saving.current = true;
    setStatus("saving");
    try {
      await opts.current.save(current.doc);
      lastSaved.current = current.json;
      hasSaved.current = true;
      setError(null);
      if (isDirty()) {
        setStatus("dirty");
        schedule(DEBOUNCE_MS);
      } else {
        setStatus("saved");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("error");
      schedule(RETRY_MS);
    } finally {
      saving.current = false;
    }
  }

  // Declared before the inputs effect so a key change re-baselines before the inputs are compared.
  useEffect(() => {
    takeSnapshot();
    lastSaved.current = latest.current!.json;
    hasSaved.current = false;
    // A hard reload or tab close inside the debounce window never unmounts, so `pagehide` flushes
    // too; taking the flushed snapshot as saved keeps the unmount that may follow from resending it.
    const flush = () => {
      if (!isDirty()) return;
      const { json, doc } = latest.current!;
      if (!opts.current.schema.safeParse(doc).success) return;
      lastSaved.current = json;
      void fetch(flushUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: json,
        credentials: "same-origin",
        // Browsers reject keepalive bodies over 64 KiB; larger documents still save because SPA navigation keeps the page alive.
        keepalive: json.length < 60_000,
      }).catch(() => undefined);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", flush);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      flush();
    };
  }, [key, flushUrl]);

  useEffect(() => {
    needsSnapshot.current = true;
    if (isHot()) {
      setStatus("dirty");
      if (!timer.current) schedule(HOLD_RECHECK_MS);
      return;
    }
    if (!isDirty()) return;
    setStatus("dirty");
    schedule(DEBOUNCE_MS);
  }, inputs);

  return { status, error };
}
