import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  type DefaultEdgeOptions,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type OnBeforeDelete,
  type OnConnect,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnSelectionChangeFunc,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import type { Scene, SceneLink } from "../../shared/api";
import { newId } from "../../shared/ids";
import { campaigns, scenes as scenesApi } from "../api/endpoints";
import { IconButton } from "../components/IconButton";
import { SidePanel } from "../components/SidePanel";
import { withColor } from "../nodes/color";
import { motionDuration } from "../physics/motion";
import { useForceLayout } from "../physics/useForceLayout";
import { SaveIndicator } from "../scene-editor/SaveIndicator";
import { LinkPanel } from "./LinkPanel";
import { ScenePanel } from "./ScenePanel";
import { SceneActionsContext, SceneNodeCard } from "./SceneNodeCard";
import { useCampaignAutosave } from "./useCampaignAutosave";
import "../graph-canvas.css";

export type SceneNode = Node<{ name: string; color: string | null }, "scene">;

const nodeTypes: NodeTypes = { scene: SceneNodeCard };

const defaultEdgeOptions: DefaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed }, animated: true };

const DELETE_KEYS = ["Backspace", "Delete"];

export interface CampaignGraphProps {
  campaignId: string;
  /** Initial layout; later changes only sync names and colours into the cards. */
  scenes: Scene[];
  links: SceneLink[];
  /** Scene shown in the layer above; while set the canvas is read-only and zoomed to that node. */
  openSceneId: string | null;
  /** True while the layers zoom in or out; this one sits at scale(1.06) whenever a scene is open. */
  layerMoving: boolean;
  /** Toolbar element the add button and save dot render into. */
  toolbarSlot: HTMLElement | null;
  onOpenScene: (id: string, at?: { x: number; y: number }) => void;
  onPrefetchScene: (id: string) => void;
  onRenameScene: (id: string, name: string) => void;
  onRecolorScene: (id: string, color: string | null) => void;
  onSceneCreated: (scene: Scene) => void;
  onSceneDeleted: (id: string) => void;
  onError: (message: string) => void;
}

function toNode(s: Scene): SceneNode {
  return withColor({ id: s.id, type: "scene", position: { x: s.x, y: s.y }, data: { name: s.name, color: s.color } }, s.color);
}

type Selection = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;

export const CampaignGraph = memo(function CampaignGraph(props: CampaignGraphProps) {
  return (
    <ReactFlowProvider>
      <CampaignGraphInner {...props} />
    </ReactFlowProvider>
  );
});

function CampaignGraphInner({
  campaignId,
  scenes,
  links,
  openSceneId,
  layerMoving,
  toolbarSlot,
  onOpenScene,
  onPrefetchScene,
  onRenameScene,
  onRecolorScene,
  onSceneCreated,
  onSceneDeleted,
  onError,
}: CampaignGraphProps) {
  const [initial] = useState(() => ({
    nodes: scenes.map(toNode),
    edges: links.map((l): Edge => ({ id: l.id, source: l.source, target: l.target, label: l.label })),
  }));
  const [nodes, setNodes, onNodesChange] = useNodesState<SceneNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selection, setSelection] = useState<Selection>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Offscreen scenes are skipped only once every node has been measured, or the layout would wait on them.
  const [visibleOnly, setVisibleOnly] = useState(false);
  const dragging = useRef(false);
  // The auto fitView runs once, on the initial settle; later settles would yank the camera mid-edit.
  const settled = useRef(false);
  // Camera to return to when the scene closes; "fit" when the scene opened before the first settle (deep link).
  const savedViewport = useRef<Viewport | "fit" | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, flowToScreenPosition, deleteElements, fitView, getNode, getNodes, getViewport, setViewport } =
    useReactFlow<SceneNode, Edge>();
  const updateNodeInternals = useUpdateNodeInternals();
  // The exit transition still owns the canvas, so it stays locked until the layer above is gone.
  const locked = openSceneId !== null || layerMoving;

  // Handle offsets are measured against the unscaled container, so they are only valid at scale 1.
  const flat = !layerMoving && openSceneId === null;
  useEffect(() => {
    if (flat) updateNodeInternals(getNodes().map((n) => n.id));
  }, [flat, getNodes, updateNodeInternals]);

  const onEnd = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    // With nothing to place the layout settles inside its own layout effect, before React Flow has painted.
    requestAnimationFrame(() => {
      setVisibleOnly(true);
      if (!savedViewport.current) void fitView({ duration: motionDuration(300), maxZoom: 1 });
    });
  }, [fitView]);

  const layout = useForceLayout<SceneNode, Edge>(nodes, edges, setNodes, { onEnd });
  const { status, error } = useCampaignAutosave(campaignId, nodes, edges, [dragging, layout.isSimulating]);

  // Zoom to the opened scene and restore the camera on close; the layer above takes all input meanwhile.
  useEffect(() => {
    if (openSceneId) {
      if (!savedViewport.current) savedViewport.current = settled.current ? getViewport() : "fit";
      void fitView({ nodes: [{ id: openSceneId }], duration: motionDuration(500), maxZoom: 1.6, padding: 0.4 });
      setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)));
      setEdges((es) => es.map((e) => (e.selected ? { ...e, selected: false } : e)));
    } else if (savedViewport.current) {
      const back = savedViewport.current;
      savedViewport.current = null;
      if (back === "fit") void fitView({ duration: motionDuration(500), maxZoom: 1 });
      else void setViewport(back, { duration: motionDuration(500) });
    }
  }, [openSceneId, fitView, getViewport, setViewport, setNodes, setEdges]);

  // Names and colours are owned by the workspace (the scene layer can change both); positions stay here.
  useEffect(() => {
    setNodes((ns) => {
      const byId = new Map(scenes.map((s) => [s.id, s]));
      let changed = false;
      const out = ns.map((n) => {
        const s = byId.get(n.id);
        if (!s || (s.name === n.data.name && s.color === n.data.color)) return n;
        changed = true;
        return withColor({ ...n, data: { name: s.name, color: s.color } }, s.color);
      });
      return changed ? out : ns;
    });
  }, [scenes, setNodes]);

  const onNodeDragStart: OnNodeDrag<SceneNode> = useCallback(
    (e, node, all) => {
      dragging.current = true;
      layout.onNodeDragStart(e, node, all);
    },
    [layout.onNodeDragStart]
  );
  const onNodeDragStop: OnNodeDrag<SceneNode> = useCallback(
    (e, node, all) => {
      dragging.current = false;
      layout.onNodeDragStop(e, node, all);
    },
    [layout.onNodeDragStop]
  );

  const onConnect: OnConnect = useCallback(
    (conn) => {
      if (conn.source === conn.target) return;
      setEdges((eds) =>
        eds.some((e) => e.source === conn.source && e.target === conn.target)
          ? eds
          : addEdge({ ...conn, id: newId(), label: "" }, eds)
      );
    },
    [setEdges]
  );

  const onSelectionChange: OnSelectionChangeFunc<SceneNode, Edge> = useCallback(
    ({ nodes: ns, edges: es }) => {
      setSelection(ns[0] ? { kind: "node", id: ns[0].id } : es[0] ? { kind: "edge", id: es[0].id } : null);
      if (ns[0]) onPrefetchScene(ns[0].id);
      // A freshly added scene keeps its name focused until the selection moves on.
      setFocusId((id) => (ns[0]?.id === id ? id : null));
    },
    [onPrefetchScene]
  );

  const onNodeMouseEnter: NodeMouseHandler<SceneNode> = useCallback((_, node) => onPrefetchScene(node.id), [onPrefetchScene]);

  // Scenes are deleted only through the confirm path; keyboard delete still removes links.
  const onBeforeDelete: OnBeforeDelete<SceneNode, Edge> = useCallback(async ({ nodes: ns }) => ns.length === 0, []);

  // Deleting a node mid-drag ends the drag without a stop event.
  const onNodesDelete: OnNodesDelete<SceneNode> = useCallback(() => {
    dragging.current = false;
  }, []);

  // The scene layer grows out of the node's centre on screen.
  const openScene = useCallback(
    (id: string) => {
      const node = getNode(id);
      const at = node?.measured?.width
        ? flowToScreenPosition({
            x: node.position.x + node.measured.width / 2,
            y: node.position.y + (node.measured.height ?? 0) / 2,
          })
        : undefined;
      onOpenScene(id, at);
    },
    [getNode, flowToScreenPosition, onOpenScene]
  );

  const onNodeClick: NodeMouseHandler<SceneNode> = useCallback((_, node) => openScene(node.id), [openScene]);

  const deleteScene = useCallback(
    async (id: string) => {
      const node = getNode(id);
      if (!node || !confirm(`Delete scene "${node.data.name}"?`)) return;
      try {
        await scenesApi.remove(id);
        setNodes((ns) => ns.filter((n) => n.id !== id));
        setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
        onSceneDeleted(id);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not delete the scene");
      }
    },
    [getNode, setNodes, setEdges, onSceneDeleted, onError]
  );

  const sceneActions = useMemo(
    () => ({ onOpen: openScene, onDelete: (id: string) => void deleteScene(id) }),
    [openScene, deleteScene]
  );

  const addScene = useCallback(async () => {
    const rect = container.current?.getBoundingClientRect();
    const centre = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
    try {
      const scene = await campaigns.createScene(campaignId, { name: "New scene", x: centre.x, y: centre.y });
      setNodes((ns) => [
        ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
        { ...toNode(scene), selected: true },
      ]);
      layout.release([scene.id]);
      setFocusId(scene.id);
      onSceneCreated(scene);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not create the scene");
    }
  }, [campaignId, screenToFlowPosition, setNodes, layout.release, onSceneCreated, onError]);

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
            <IconButton icon={Plus} label="Add scene" onClick={() => void addScene()} />
            <SaveIndicator status={status} error={error} />
          </>,
          toolbarSlot
        )}
      <div className="graph-canvas__main">
        <div className="graph-canvas__viewport" ref={container}>
          <SceneActionsContext.Provider value={sceneActions}>
            {/* Distinct id: background pattern, arrow marker and a11y ids default to "1" and would collide with the scene flow. */}
            <ReactFlow<SceneNode, Edge>
              id="campaign"
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              onNodeClick={onNodeClick}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={layout.onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onBeforeDelete={onBeforeDelete}
              onNodesDelete={onNodesDelete}
              defaultEdgeOptions={defaultEdgeOptions}
              defaultMarkerColor="var(--pastel-route)"
              // React Flow's key listeners live on document, so they are disabled while the scene layer has the keyboard.
              deleteKeyCode={locked ? null : DELETE_KEYS}
              elementsSelectable={!locked}
              nodesDraggable={!locked}
              onlyRenderVisibleElements={visibleOnly}
              fitView
              fitViewOptions={{ maxZoom: 1 }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </SceneActionsContext.Provider>
        </div>
        <SidePanel open={!!(selectedNode || selectedEdge)}>
          {selectedNode ? (
            <ScenePanel
              key={selectedNode.id}
              node={selectedNode}
              autoFocus={focusId === selectedNode.id}
              onRename={(name) => onRenameScene(selectedNode.id, name)}
              onChangeColor={(color) => onRecolorScene(selectedNode.id, color)}
              onOpen={() => openScene(selectedNode.id)}
              onDelete={() => void deleteScene(selectedNode.id)}
            />
          ) : selectedEdge ? (
            <LinkPanel
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
