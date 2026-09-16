import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { MAP_LIMITS, type MapNodeData, type MapStroke } from "../../shared/nodes/map";
import { drawMap, drawStroke, mapPixelSize } from "./draw";
import { cellIndexAt, strokeIndexAt } from "./hitTest";
import type { ToolState } from "./tools";

export interface MapCanvasProps {
  data: MapNodeData;
  tools: ToolState;
  image: HTMLImageElement | null;
  /** Called once per finished gesture with the resulting data. */
  onCommit: (next: MapNodeData) => void;
  onWarning: (message: string | null) => void;
}

// Map pixels; pen points closer than this to the previous one are dropped.
const MIN_POINT_GAP = 2;
// Extra map pixels beyond the stroke's half width that still count as a hit when erasing.
const ERASE_TOLERANCE = 6;

type Gesture =
  | { kind: "cells"; cells: number[]; changed: boolean }
  | { kind: "pen"; points: number[]; capped: boolean }
  | { kind: "strokes"; strokes: MapStroke[]; changed: boolean };

export function MapCanvas({ data, tools, image, onCommit, onWarning }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const frameRef = useRef(0);
  // Pointer handlers and the rAF callback read the latest props through this ref.
  const latest = useRef({ data, tools, image, onCommit, onWarning });
  latest.current = { data, tools, image, onCommit, onWarning };

  const draw = useCallback(() => {
    frameRef.current = 0;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { data, tools, image } = latest.current;
    const g = gestureRef.current;
    const view =
      g?.kind === "cells" ? { ...data, cells: g.cells } : g?.kind === "strokes" ? { ...data, strokes: g.strokes } : data;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMap(ctx, view, { scale: tools.zoom, image, showGrid: true });
    if (g?.kind === "pen") {
      ctx.save();
      ctx.scale(tools.zoom, tools.zoom);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      drawStroke(ctx, tools.penColor, tools.penWidth, g.points);
      ctx.restore();
    }
  }, []);

  const schedule = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  const { width, height } = mapPixelSize(data);
  const zoom = tools.zoom;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * zoom * dpr);
    canvas.height = Math.round(height * zoom * dpr);
    canvas.style.width = `${width * zoom}px`;
    canvas.style.height = `${height * zoom}px`;
    schedule();
  }, [width, height, zoom, schedule]);

  useEffect(() => {
    schedule();
  }, [data, image, schedule]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function toMap(e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    const z = latest.current.tools.zoom;
    return {
      x: Math.round(((e.clientX - rect.left) / z) * 10) / 10,
      y: Math.round(((e.clientY - rect.top) / z) * 10) / 10,
    };
  }

  function apply(p: { x: number; y: number }) {
    const g = gestureRef.current;
    if (!g) return;
    const { data, tools, onWarning } = latest.current;
    switch (g.kind) {
      case "cells": {
        const i = cellIndexAt(data, p.x, p.y);
        if (i === -1) return;
        if (tools.tool === "paint" && tools.paletteIndex >= data.palette.length) return;
        const value = tools.tool === "erase" ? 0 : tools.paletteIndex + 1;
        if (g.cells[i] === value) return;
        g.cells[i] = value;
        g.changed = true;
        schedule();
        return;
      }
      case "pen": {
        if (g.capped) return;
        const n = g.points.length;
        if (n >= 2 && Math.hypot(p.x - g.points[n - 2], p.y - g.points[n - 1]) < MIN_POINT_GAP) return;
        const used = data.strokes.reduce((t, s) => t + s.points.length, 0);
        if (used + n + 2 > MAP_LIMITS.maxTotalPoints) {
          g.capped = true;
          onWarning(`Stroke point limit (${MAP_LIMITS.maxTotalPoints}) reached; the stroke was cut short.`);
          return;
        }
        g.points.push(p.x, p.y);
        schedule();
        return;
      }
      case "strokes": {
        const idx = strokeIndexAt(g.strokes, p.x, p.y, ERASE_TOLERANCE);
        if (idx === -1) return;
        g.strokes.splice(idx, 1);
        g.changed = true;
        schedule();
        return;
      }
    }
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0 || gestureRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { data, tools, onWarning } = latest.current;
    if (tools.tool === "pen") gestureRef.current = { kind: "pen", points: [], capped: false };
    else if (tools.tool === "erase" && tools.eraseMode === "strokes")
      gestureRef.current = { kind: "strokes", strokes: data.strokes.slice(), changed: false };
    else gestureRef.current = { kind: "cells", cells: data.cells.slice(), changed: false };
    onWarning(null);
    apply(toMap(e));
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (gestureRef.current) apply(toMap(e));
  }

  function finish() {
    const g = gestureRef.current;
    if (!g) return;
    gestureRef.current = null;
    const { data, tools, onCommit } = latest.current;
    if (g.kind === "cells" && g.changed) onCommit({ ...data, cells: g.cells });
    else if (g.kind === "strokes" && g.changed) onCommit({ ...data, strokes: g.strokes });
    else if (g.kind === "pen" && g.points.length >= 2)
      onCommit({ ...data, strokes: [...data.strokes, { color: tools.penColor, width: tools.penWidth, points: g.points }] });
    schedule();
  }

  return (
    <canvas
      ref={canvasRef}
      className={`map-editor__canvas map-editor__canvas--${tools.tool}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  );
}
