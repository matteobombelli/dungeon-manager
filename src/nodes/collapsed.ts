import { useSyncExternalStore } from "react";

// Session-only: which editor sections are folded, keyed "nodeId:sectionId". Not persisted on purpose.
const collapsed = new Set<string>();
const listeners = new Set<() => void>();

function key(nodeId: string, sectionId: string): string {
  return `${nodeId}:${sectionId}`;
}

export function useCollapsed(nodeId: string, sectionId: string): [boolean, () => void] {
  const k = key(nodeId, sectionId);
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => collapsed.has(k)
  );
  const toggle = () => {
    if (collapsed.has(k)) collapsed.delete(k);
    else collapsed.add(k);
    listeners.forEach((cb) => cb());
  };
  return [value, toggle];
}
