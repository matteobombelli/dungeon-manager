import { useCallback, useReducer, useRef } from "react";
import type { Graph } from "../../shared/graph";
import { scenes as scenesApi } from "../api/endpoints";

export interface SceneCacheEntry {
  graph: Graph;
  source: "fetch" | "editor";
}

const MAX_PREFETCH = 3;

/**
 * Scene graphs by id for the workspace. Prefetches (hover, selection) run at most MAX_PREFETCH at a
 * time; `load` is for the scene being opened and skips the queue. An "editor" entry is the graph as
 * the editor last had it and is never replaced by a fetch that resolves later. Every settled fetch
 * re-renders the caller: the open scene and the previewed scene both read the cache during render.
 */
export function useSceneCache() {
  const cache = useRef(new Map<string, SceneCacheEntry>());
  const failed = useRef(new Map<string, string>());
  const inflight = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const fetchNow = useCallback((id: string) => {
    inflight.current.add(id);
    failed.current.delete(id);
    scenesApi
      .get(id)
      .then(({ graph }) => {
        if (!cache.current.has(id)) cache.current.set(id, { graph, source: "fetch" });
      })
      .catch((err: unknown) => failed.current.set(id, err instanceof Error ? err.message : "Failed to load scene"))
      .finally(() => {
        inflight.current.delete(id);
        rerender();
        const next = queue.current.shift();
        if (next) fetchNow(next);
      });
  }, []);

  const prefetch = useCallback(
    (id: string) => {
      // A failed scene is only retried by `load`, or hovering its node would refetch it endlessly.
      if (cache.current.has(id) || failed.current.has(id) || inflight.current.has(id) || queue.current.includes(id)) return;
      if (inflight.current.size >= MAX_PREFETCH) queue.current.push(id);
      else fetchNow(id);
    },
    [fetchNow]
  );

  const load = useCallback(
    (id: string) => {
      if (cache.current.has(id) || inflight.current.has(id)) return;
      queue.current = queue.current.filter((q) => q !== id);
      fetchNow(id);
    },
    [fetchNow]
  );

  /** The cached graph, or a fetch of it that skips the prefetch queue. */
  const read = useCallback(async (id: string): Promise<Graph> => {
    const hit = cache.current.get(id);
    if (hit) return hit.graph;
    const { graph } = await scenesApi.get(id);
    if (!cache.current.has(id)) cache.current.set(id, { graph, source: "fetch" });
    return graph;
  }, []);

  const store = useCallback((id: string, graph: Graph) => {
    cache.current.set(id, { graph, source: "editor" });
  }, []);

  const forget = useCallback((id: string) => {
    cache.current.delete(id);
    failed.current.delete(id);
    queue.current = queue.current.filter((q) => q !== id);
  }, []);

  return {
    get: (id: string) => cache.current.get(id),
    errorOf: (id: string) => failed.current.get(id),
    prefetch,
    load,
    read,
    store,
    forget,
  };
}
