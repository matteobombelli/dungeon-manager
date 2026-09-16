import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  type DefaultEdgeOptions,
  type Edge,
  type OnConnect,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Prefab } from "../../shared/api";
import { canonicalEdge, normaliseEdges, type Graph } from "../../shared/graph";
import { newId } from "../../shared/ids";
import type { NodeTypeId } from "../../shared/nodes/registry";
import { SidePanel } from "../components/SidePanel";
import { withColor } from "../nodes/color";
import { nodeTypes, type AppNode } from "../nodes/registry";
import { NODE_SHAPES } from "../nodes/shapes";
import { motionDuration } from "../physics/motion";
import { useForceLayout } from "../physics/useForceLayout";
import { AddNodeMenu } from "./AddNodeMenu";
import { EdgePanel } from "./EdgePanel";
import { NodePanel } from "./NodePanel";
import { SaveIndicator } from "./SaveIndicator";
import { toGraph, useAutosave } from "./useAutosave";
import "../graph-canvas.css";

export interface SceneEditorProps {
  sceneId: string;
  graph: Graph;
  prefabs: Prefab[];
  /** Toolbar element the add menu and save dot render into. */
  toolbarSlot: HTMLElement | null;
  /** True while the layer zooms in or out; the canvas is scaled by an ancestor until it is false. */
  layerMoving: boolean;
  /** Receives the final graph when the editor unmounts. */
  onUnmount: (graph: Graph) => void;
  /** Escape with nothing selected. */
  onClose: () => void;
  onPrefabCreated: (prefab: Prefab) => void;
  onPrefabUpdated: (prefab: Prefab) => void;
}

const defaultEdgeOptions: DefaultEdgeOptions = { type: "straight" };

const DELETE_KEYS = ["Backspace", "Delete"];

function fromGraph(graph: Graph): { nodes: AppNode[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((n) =>
      withColor({ id: n.id, type: n.type, position: { x: n.x, y: n.y }, data: n.data as Record<string, unknown> }, n.color)
    ),
    edges: normaliseEdges(graph.edges).map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
  };
}

// Round shapes collide on their radius; the rest on the half-diagonal so corners stay clear.
function collisionRadius(node: AppNode): number {
  const w = node.measured?.width ?? 200;
  const h = node.measured?.height ?? 80;
  const shape = NODE_SHAPES[node.type];
  return shape === "circle" || shape === "pill" ? Math.max(w, h) / 2 : Math.hypot(w, h) / 2;
}

type Selection = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;

export function SceneEditor(props: SceneEditorProps) {
  return (
    <ReactFlowProvider>
      <SceneEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function SceneEditorInner({
  sceneId,
  graph,
  prefabs,
  toolbarSlot,
  layerMoving,
  onUnmount,
  onClose,
  onPrefabCreated,
  onPrefabUpdated,
}: SceneEditorProps) {
  const [initial] = useState(() => fromGraph(graph));
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selection, setSelection] = useState<Selection>(null);
  // Mirrors `selection` for the Escape listener: React Flow reports a deselect from a passive effect,
  // and a key press in the same frame would otherwise see the previous render's closure.
  const selectionRef = useRef<Selection>(null);
  const dragging = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, deleteElements, fitView, getNodes } = useReactFlow<AppNode, Edge>();
  const updateNodeInternals = useUpdateNodeInternals();

  // Handle offsets are measured against the unscaled container, so they are only valid at scale 1.
  useEffect(() => {
    if (!layerMoving) updateNodeInternals(getNodes().map((n) => n.id));
  }, [layerMoving, getNodes, updateNodeInternals]);

  // Only the load-time settle re-fits the view; later settles would yank the camera mid-edit.
  const settledOnce = useRef(false);
  const onEnd = useCallback(() => {
    if (settledOnce.current) return;
    settledOnce.current = true;
    // With nothing to place the layout settles inside its own layout effect, before React Flow has painted.
    requestAnimationFrame(() => void fitView({ duration: motionDuration(300), maxZoom: 1 }));
  }, [fitView]);

  const layout = useForceLayout(nodes, edges, setNodes, { radius: collisionRadius, onEnd });
  const { status, error } = useAutosave(sceneId, nodes, edges, [dragging, layout.isSimulating]);

  const latest = useRef({ nodes, edges, onUnmount });
  latest.current = { nodes, edges, onUnmount };
  useEffect(
    () => () => {
      const { nodes, edges, onUnmount } = latest.current;
      onUnmount(toGraph(nodes, edges));
    },
    []
  );

  // Escape clears the selection, or closes the scene when nothing is selected. Inputs, the side
  // panel (.nokey), dialogs and the add menu (which preventDefaults) keep their own Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, .nokey")) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (!selectionRef.current) {
        onClose();
        return;
      }
      setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)));
      setEdges((es) => es.map((ed) => (ed.selected ? { ...ed, selected: false } : ed)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, setNodes, setEdges]);

  const onNodeDragStart: OnNodeDrag<AppNode> = useCallback(
    (event, node, dragged) => {
      dragging.current = true;
      layout.onNodeDragStart(event, node, dragged);
    },
    [layout.onNodeDragStart]
  );
  const onNodeDragStop: OnNodeDrag<AppNode> = useCallback(
    (event, node, dragged) => {
      dragging.current = false;
      layout.onNodeDragStop(event, node, dragged);
    },
    [layout.onNodeDragStop]
  );

  const onConnect: OnConnect = useCallback(
    (conn) => {
      if (conn.source === conn.target) return;
      const { source, target } = canonicalEdge(conn);
      setEdges((eds) =>
        eds.some((e) => e.source === source && e.target === target)
          ? eds
          : [...eds, { id: newId(), source, target, label: "" }]
      );
    },
    [setEdges]
  );

  const onSelectionChange: OnSelectionChangeFunc<AppNode, Edge> = useCallback(({ nodes: ns, edges: es }) => {
    selectionRef.current = ns[0] ? { kind: "node", id: ns[0].id } : es[0] ? { kind: "edge", id: es[0].id } : null;
    setSelection(selectionRef.current);
  }, []);

  // Deleting a node mid-drag ends the drag without a stop event.
  const onNodesDelete: OnNodesDelete<AppNode> = useCallback(() => {
    dragging.current = false;
  }, []);

  const addNode = useCallback(
    (type: NodeTypeId, data: Record<string, unknown>) => {
      const rect = container.current?.getBoundingClientRect();
      const centre = rect
        ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 0, y: 0 };
      const id = newId();
      setNodes((ns) => {
        // Cascade successive additions so new nodes don't stack on the same point.
        const offset = (ns.length % 8) * 32;
        const position = { x: centre.x + offset, y: centre.y + offset };
        return [
          ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
          withColor({ id, type, position, data, selected: true }, null),
        ];
      });
      layout.release([id]);
    },
    [screenToFlowPosition, setNodes, layout.release]
  );

  const updateNodeData = (id: string, data: Record<string, unknown>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data } : n)));

  const updateNodeColor = (id: string, color: string | null) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? withColor(n, color) : n)));

  const updateEdgeLabel = (id: string, label: string) =>
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, label } : e)));

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedNode = selection?.kind === "node" ? nodeById.get(selection.id) : undefined;
  const selectedEdge = selection?.kind === "edge" ? edges.find((e) => e.id === selection.id) : undefined;

  return (
    <div className="graph-canvas">
      {toolbarSlot &&
        createPortal(
          <>
            <AddNodeMenu prefabs={prefabs} onAdd={addNode} />
            <SaveIndicator status={status} error={error} />
          </>,
          toolbarSlot
        )}
      <div className="graph-canvas__main">
        <div className="graph-canvas__viewport" ref={container}>
          {/* Distinct id: background pattern, arrow marker and a11y ids default to "1" and would collide with the campaign flow. */}
          <ReactFlow<AppNode, Edge>
            id="scene"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={layout.onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={defaultEdgeOptions}
            deleteKeyCode={layerMoving ? null : DELETE_KEYS}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <SidePanel open={!!(selectedNode || selectedEdge)}>
          {selectedNode ? (
            <NodePanel
              key={selectedNode.id}
              node={selectedNode}
              onChange={(data) => updateNodeData(selectedNode.id, data)}
              onChangeColor={(color) => updateNodeColor(selectedNode.id, color)}
              onDelete={() => void deleteElements({ nodes: [{ id: selectedNode.id }] })}
              onPrefabCreated={onPrefabCreated}
              onPrefabUpdated={onPrefabUpdated}
            />
          ) : selectedEdge ? (
            <EdgePanel
              key={selectedEdge.id}
              edge={selectedEdge}
              onChangeLabel={(label) => updateEdgeLabel(selectedEdge.id, label)}
              onDelete={() => void deleteElements({ edges: [{ id: selectedEdge.id }] })}
            />
          ) : null}
        </SidePanel>
      </div>
    </div>
  );
}
