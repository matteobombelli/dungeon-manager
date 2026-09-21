import { createContext, memo, useCallback, useContext, type CSSProperties } from "react";
import { BaseEdge, MarkerType, useInternalNode, useStore, type Edge, type EdgeProps, type InternalNode, type ReactFlowState } from "@xyflow/react";
import type { SceneLink } from "../../shared/api";
import { midpoint, roundedPath, routeAround, type Point, type Rect } from "./route-path";

export type RouteEdge = Edge<{ color: string | null }, "route">;

/** Sets a link's persisted colour on the edge and on its arrowhead; null falls back to the route pastel. */
export function withRouteColor(edge: Omit<RouteEdge, "data" | "markerEnd">, color: string | null): RouteEdge {
  // No colour key at all for the default: React Flow spreads the marker over its default colour, so undefined would win.
  return { ...edge, data: { color }, markerEnd: { type: MarkerType.ArrowClosed, ...(color ? { color } : {}) } };
}

export function toRouteEdge(link: SceneLink): RouteEdge {
  return withRouteColor({ id: link.id, type: "route", source: link.source, target: link.target, label: link.label }, link.color);
}

export const pairKey = (source: string, target: string) => `${source}\n${target}`;

/** pairKey of every link whose reverse also exists; the two are drawn side by side instead of on top of each other. */
export const TwoWayLinksContext = createContext<ReadonlySet<string>>(new Set());

const TWO_WAY_GAP = 6;
/** Clearance kept between an arrow and the cards it bends around. */
const CLEARANCE = 16;
const BEND_RADIUS = 24;
/** Width of the invisible strip that selects the arrow; thin dashes are hard to hit at React Flow's default 20. */
const HIT_WIDTH = 44;

function centreOf(node: InternalNode): Point {
  const { x, y } = node.internals.positionAbsolute;
  return { x: x + (node.measured.width ?? 0) / 2, y: y + (node.measured.height ?? 0) / 2 };
}

function boxOf(node: InternalNode, margin: number): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return { left: x - margin, top: y - margin, right: x + (node.measured.width ?? 0) + margin, bottom: y + (node.measured.height ?? 0) + margin };
}

/** Where the ray from a card's centre towards `to` leaves the card's box. */
function borderPoint(node: InternalNode, to: Point): Point {
  const c = centreOf(node);
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  const t = Math.min(
    dx ? (node.measured.width ?? 0) / 2 / Math.abs(dx) : Infinity,
    dy ? (node.measured.height ?? 0) / 2 / Math.abs(dy) : Infinity
  );
  return Number.isFinite(t) ? { x: c.x + dx * t, y: c.y + dy * t } : c;
}

const NO_RECTS: Rect[] = [];

const sameRects = (a: Rect[], b: Rect[]) =>
  a.length === b.length && a.every((r, i) => r.left === b[i].left && r.top === b[i].top && r.right === b[i].right && r.bottom === b[i].bottom);

/** A straight arrow aimed at the target card's centre, clipped to both cards' borders and bent around any card in between. */
export const RouteEdgeView = memo(function RouteEdgeView({ source, target, label, markerEnd, data }: EdgeProps<RouteEdge>) {
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  const twoWay = useContext(TwoWayLinksContext).has(pairKey(source, target));
  // Only the cards inside the straight line's bounding box can be in the way; the edge re-renders when one of them moves.
  const obstacles = useStore(
    useCallback(
      (s: ReactFlowState) => {
        const a = s.nodeLookup.get(source);
        const b = s.nodeLookup.get(target);
        if (!a || !b) return NO_RECTS;
        const ac = centreOf(a);
        const bc = centreOf(b);
        // Detours step outside the line's box by the clearance, so the box is widened by as much.
        const span: Rect = {
          left: Math.min(ac.x, bc.x) - CLEARANCE * 2,
          top: Math.min(ac.y, bc.y) - CLEARANCE * 2,
          right: Math.max(ac.x, bc.x) + CLEARANCE * 2,
          bottom: Math.max(ac.y, bc.y) + CLEARANCE * 2,
        };
        const out: Rect[] = [];
        for (const n of s.nodeLookup.values()) {
          if (n.id === source || n.id === target || !n.measured.width) continue;
          const r = boxOf(n, CLEARANCE);
          if (r.left < span.right && r.right > span.left && r.top < span.bottom && r.bottom > span.top) out.push(r);
        }
        return out.length ? out : NO_RECTS;
      },
      [source, target]
    ),
    sameRects
  );
  if (!from || !to) return null;

  const fromCentre = centreOf(from);
  const toCentre = centreOf(to);
  const bends = routeAround(fromCentre, toCentre, obstacles);
  const start = borderPoint(from, bends[0] ?? toCentre);
  const end = borderPoint(to, bends[bends.length - 1] ?? fromCentre);
  const points = [start, ...bends, end];
  if (twoWay) {
    // Shift to the right of the direction of travel, so the reverse link shifts the other way.
    const length = Math.hypot(toCentre.x - fromCentre.x, toCentre.y - fromCentre.y) || 1;
    const nx = (-(toCentre.y - fromCentre.y) / length) * TWO_WAY_GAP;
    const ny = ((toCentre.x - fromCentre.x) / length) * TWO_WAY_GAP;
    for (const p of points) {
      p.x += nx;
      p.y += ny;
    }
  }
  const labelAt = midpoint(points);
  // The stroke is read through --route so the selected and animated rules in graph-canvas.css still apply.
  const tint = { "--route": data?.color ?? undefined } as CSSProperties;
  return (
    <BaseEdge
      path={roundedPath(points, BEND_RADIUS)}
      label={label}
      labelX={labelAt.x}
      labelY={labelAt.y}
      markerEnd={markerEnd}
      interactionWidth={HIT_WIDTH}
      style={tint}
      labelBgStyle={tint}
    />
  );
});
