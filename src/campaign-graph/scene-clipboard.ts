import type { Graph } from "../../shared/graph";
import { withFreshIds } from "../nodes/clipboard";

/** A copied scene, positioned relative to the copied selection's top-left corner. */
export interface ClipScene {
  name: string;
  color: string | null;
  dx: number;
  dy: number;
  graph: Graph;
}

/** A copied link between two copied scenes, by their index in the clipboard. */
export interface ClipLink {
  from: number;
  to: number;
  label: string;
  color: string | null;
}

export interface SceneToPaste {
  name: string;
  color: string | null;
  x: number;
  y: number;
  /** Fresh node ids on every paste, so two pastes of one scene never share a node. */
  graph: Graph;
}

// Separate from the node clipboard: copying scenes on the campaign canvas leaves copied nodes alone.
let clipboard: { scenes: ClipScene[]; links: ClipLink[] } = { scenes: [], links: [] };

export function copyScenes(
  scenes: { id: string; name: string; color: string | null; x: number; y: number; graph: Graph }[],
  links: { source: string; target: string; label: string; color: string | null }[]
): void {
  if (scenes.length === 0) return;
  const minX = Math.min(...scenes.map((s) => s.x));
  const minY = Math.min(...scenes.map((s) => s.y));
  const index = new Map(scenes.map((s, i) => [s.id, i]));
  clipboard = {
    scenes: scenes.map((s) => ({ name: s.name, color: s.color, dx: s.x - minX, dy: s.y - minY, graph: structuredClone(s.graph) })),
    links: links.flatMap((l) => {
      const from = index.get(l.source);
      const to = index.get(l.target);
      return from !== undefined && to !== undefined ? [{ from, to, label: l.label, color: l.color }] : [];
    }),
  };
}

export function pasteScenes(origin: { x: number; y: number }): { scenes: SceneToPaste[]; links: ClipLink[] } {
  return {
    scenes: clipboard.scenes.map((s) => ({
      name: s.name,
      color: s.color,
      x: origin.x + s.dx,
      y: origin.y + s.dy,
      graph: { nodes: withFreshIds(s.graph.nodes) },
    })),
    links: clipboard.links,
  };
}
