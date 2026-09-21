import { useCallback, useEffect, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useNodesInitialized, type Edge, type Node, type OnNodeDrag } from "@xyflow/react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Force,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

export interface ForceLayoutOptions<N extends Node> {
  /** Soft box around the centroid of the pinned nodes that free nodes are pushed back into. */
  bounds?: { width: number; height: number };
  /** Collision radius per node; default is the half-diagonal of the measured size. */
  radius?: (node: N) => number;
  /** Fired when the simulation settles, and on first sync when there is nothing to place. */
  onEnd?: () => void;
}

export interface ForceLayout<N extends Node> {
  isSimulating: RefObject<boolean>;
  /** Marks nodes as free to be placed by the simulation (call right after adding them). */
  release: (ids: string[]) => void;
  onNodeDragStart: OnNodeDrag<N>;
  onNodeDrag: OnNodeDrag<N>;
  onNodeDragStop: OnNodeDrag<N>;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  w: number;
  h: number;
}

type SimLink = SimulationLinkDatum<SimNode>;

interface SimState {
  sim: Simulation<SimNode, SimLink>;
  link: ReturnType<typeof forceLink<SimNode, SimLink>>;
  collide: ReturnType<typeof forceCollide<SimNode>>;
  byId: Map<string, SimNode>;
  synced: boolean;
}

const DEFAULT_BOUNDS = { width: 2400, height: 1600 };
const FALLBACK_SIZE = { width: 200, height: 80 };
const COLLIDE_PADDING = 12;
const MIN_MOVE = 0.05;
const BOUNDARY_STRENGTH = 0.1;

function sizeOf(node: Node): { w: number; h: number } {
  return { w: node.measured?.width ?? FALLBACK_SIZE.width, h: node.measured?.height ?? FALLBACK_SIZE.height };
}

function isUnplaced(node: Node): boolean {
  return node.position.x === 0 && node.position.y === 0;
}

/** Centre of the pinned nodes; free nodes are pulled towards it instead of towards the origin. */
function centroidOf(nodes: SimNode[]): { x: number; y: number } {
  const pinned = nodes.filter((s) => s.fx !== undefined && s.fy !== undefined);
  const from = pinned.length > 0 ? pinned : nodes.filter((s) => s.x !== undefined && s.y !== undefined);
  if (from.length === 0) return { x: 0, y: 0 };
  return {
    x: from.reduce((sum, s) => sum + (s.fx ?? s.x ?? 0), 0) / from.length,
    y: from.reduce((sum, s) => sum + (s.fy ?? s.y ?? 0), 0) / from.length,
  };
}

/**
 * Force layout for a React Flow canvas where placement is the user's, not the simulation's:
 * every node is pinned (fx/fy) unless it has been released, so a node only ever moves while it is
 * free. Nodes are freed by `release` (a just-added node) or by the legacy 0,0 unplaced sentinel,
 * and are pinned again where they landed when the simulation settles. Dragging writes fx/fy
 * directly and never runs the simulation.
 */
export function useForceLayout<N extends Node, E extends Edge>(
  nodes: N[],
  edges: E[],
  setNodes: Dispatch<SetStateAction<N[]>>,
  options: ForceLayoutOptions<N> = {}
): ForceLayout<N> {
  const initialized = useNodesInitialized();
  const state = useRef<SimState | null>(null);
  const free = useRef(new Set<string>());
  const centroid = useRef({ x: 0, y: 0 });
  const isSimulating = useRef(false);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const optionsRef = useRef(options);
  const setNodesRef = useRef(setNodes);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  optionsRef.current = options;
  setNodesRef.current = setNodes;

  const structureKey = useMemo(() => {
    const ids = nodes.map((n) => n.id).sort();
    const pairs = edges
      .map((e) => (e.source < e.target ? `${e.source}>${e.target}` : `${e.target}>${e.source}`))
      .sort();
    return `${ids.join(",")}|${pairs.join(",")}`;
  }, [nodes, edges]);

  const getState = useCallback((): SimState => {
    if (state.current) return state.current;
    const byId = new Map<string, SimNode>();
    const link = forceLink<SimNode, SimLink>([])
      .id((d) => d.id)
      .distance(220)
      .strength(0.5);
    const collide = forceCollide<SimNode>().radius((d) => {
      const custom = optionsRef.current.radius;
      const node = custom ? nodesRef.current.find((n) => n.id === d.id) : undefined;
      return (node && custom ? custom(node) : Math.hypot(d.w, d.h) / 2) + COLLIDE_PADDING;
    });
    const centreX = () => centroid.current.x;
    const centreY = () => centroid.current.y;
    let boundaryNodes: SimNode[] = [];
    const boundary: Force<SimNode, SimLink> = (alpha) => {
      const { width, height } = optionsRef.current.bounds ?? DEFAULT_BOUNDS;
      const hw = width / 2;
      const hh = height / 2;
      const cx = centreX();
      const cy = centreY();
      for (const n of boundaryNodes) {
        const dx = (n.x ?? cx) - cx;
        const dy = (n.y ?? cy) - cy;
        if (dx > hw) n.vx = (n.vx ?? 0) - (dx - hw) * BOUNDARY_STRENGTH * alpha;
        else if (dx < -hw) n.vx = (n.vx ?? 0) + (-hw - dx) * BOUNDARY_STRENGTH * alpha;
        if (dy > hh) n.vy = (n.vy ?? 0) - (dy - hh) * BOUNDARY_STRENGTH * alpha;
        else if (dy < -hh) n.vy = (n.vy ?? 0) + (-hh - dy) * BOUNDARY_STRENGTH * alpha;
      }
    };
    boundary.initialize = (ns) => {
      boundaryNodes = ns;
    };
    const sim = forceSimulation<SimNode, SimLink>([])
      .force("link", link)
      .force("charge", forceManyBody<SimNode>().strength(-600))
      .force("collide", collide)
      .force("x", forceX<SimNode>(centreX).strength(0.02))
      .force("y", forceY<SimNode>(centreY).strength(0.02))
      .force("boundary", boundary)
      .velocityDecay(0.2)
      .alphaDecay(0.03)
      .alphaMin(0.005)
      .stop();
    sim.on("tick", () => {
      setNodesRef.current((ns) => {
        let changed = false;
        const out = ns.map((n) => {
          if (n.dragging) return n;
          const s = byId.get(n.id);
          if (!s || s.x === undefined || s.y === undefined) return n;
          const x = s.x - s.w / 2;
          const y = s.y - s.h / 2;
          if (Math.abs(x - n.position.x) < MIN_MOVE && Math.abs(y - n.position.y) < MIN_MOVE) return n;
          changed = true;
          return { ...n, position: { x, y } };
        });
        return changed ? out : ns;
      });
    });
    sim.on("end", () => {
      for (const s of byId.values()) {
        s.fx = s.x;
        s.fy = s.y;
      }
      free.current.clear();
      isSimulating.current = false;
      optionsRef.current.onEnd?.();
    });
    state.current = { sim, link, collide, byId, synced: false };
    return state.current;
  }, []);

  const start = useCallback(
    (alpha: number) => {
      const { sim } = getState();
      if (sim.alpha() < alpha) sim.alpha(alpha);
      isSimulating.current = true;
      sim.restart();
    },
    [getState]
  );

  // Structural sync: keep sim nodes by id so velocity survives, add new, drop removed, rebuild links.
  useEffect(() => {
    if (!initialized) return;
    const st = getState();
    const current = nodesRef.current;
    const ids = new Set(current.map((n) => n.id));
    for (const id of st.byId.keys()) if (!ids.has(id)) st.byId.delete(id);
    for (const id of free.current) if (!ids.has(id)) free.current.delete(id);
    const simNodes = current.map((n) => {
      let s = st.byId.get(n.id);
      if (!s) {
        s = { id: n.id, ...sizeOf(n) };
        st.byId.set(n.id, s);
        if (isUnplaced(n)) free.current.add(n.id);
      }
      if (free.current.has(n.id)) {
        s.fx = undefined;
        s.fy = undefined;
        if (!isUnplaced(n)) {
          s.x = n.position.x + s.w / 2;
          s.y = n.position.y + s.h / 2;
        }
      } else {
        s.fx = n.position.x + s.w / 2;
        s.fy = n.position.y + s.h / 2;
      }
      return s;
    });
    // The x/y forces read the centroid when the node list is set, so it is refreshed first or a
    // first node would be pulled towards the origin.
    centroid.current = centroidOf(simNodes);
    st.sim.nodes(simNodes);
    st.link.links(
      edgesRef.current
        .filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target)
        .map((e) => ({ source: e.source, target: e.target }))
    );
    if (free.current.size > 0) start(st.synced ? 0.6 : 0.5);
    else if (!st.synced) optionsRef.current.onEnd?.();
    st.synced = true;
  }, [initialized, structureKey, getState, start]);

  // Refresh measured sizes without reheating; keep the top-left corner where React Flow has it.
  useEffect(() => {
    const st = state.current;
    if (!st) return;
    let changed = false;
    for (const n of nodes) {
      const s = st.byId.get(n.id);
      if (!s || !n.measured?.width || !n.measured?.height) continue;
      if (s.w === n.measured.width && s.h === n.measured.height) continue;
      s.w = n.measured.width;
      s.h = n.measured.height;
      if (s.fx === undefined) {
        s.x = n.position.x + s.w / 2;
        s.y = n.position.y + s.h / 2;
      } else {
        s.fx = n.position.x + s.w / 2;
        s.fy = n.position.y + s.h / 2;
      }
      changed = true;
    }
    if (changed) st.collide.radius(st.collide.radius());
  }, [nodes]);

  useEffect(() => {
    return () => {
      state.current?.sim.stop();
      state.current = null;
      free.current.clear();
      isSimulating.current = false;
    };
  }, []);

  const release = useCallback((ids: string[]) => {
    for (const id of ids) free.current.add(id);
  }, []);

  const pin = useCallback((dragged: N[]) => {
    const st = state.current;
    if (!st) return;
    for (const n of dragged) {
      const s = st.byId.get(n.id);
      if (!s) continue;
      s.fx = n.position.x + s.w / 2;
      s.fy = n.position.y + s.h / 2;
    }
  }, []);

  const onNodeDragStart = useCallback<OnNodeDrag<N>>((_event, _node, dragged) => pin(dragged), [pin]);

  const onNodeDrag = useCallback<OnNodeDrag<N>>((_event, _node, dragged) => pin(dragged), [pin]);

  const onNodeDragStop = useCallback<OnNodeDrag<N>>((_event, _node, dragged) => {
    const st = state.current;
    if (!st) return;
    for (const n of dragged) {
      const s = st.byId.get(n.id);
      if (!s) continue;
      s.x = n.position.x + s.w / 2;
      s.y = n.position.y + s.h / 2;
      s.fx = s.x;
      s.fy = s.y;
      free.current.delete(n.id);
    }
  }, []);

  return { isSimulating, release, onNodeDragStart, onNodeDrag, onNodeDragStop };
}
