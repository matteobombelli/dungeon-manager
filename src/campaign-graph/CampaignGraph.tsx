import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  type DefaultEdgeOptions,
  type EdgeTypes,
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
import { isInputDOMNode } from "@xyflow/system";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import type { Scene, SceneLink } from "../../shared/api";
import type { CampaignGraph as CampaignGraphDoc } from "../../shared/campaign-graph";
import type { Graph, NodeOutline } from "../../shared/graph";
import { newId } from "../../shared/ids";
import { campaigns, scenes as scenesApi } from "../api/endpoints";
import { HistoryButtons } from "../components/HistoryButtons";
import { MultiSelectPanel } from "../components/MultiSelectPanel";
import { SidePanel } from "../components/SidePanel";
import { useHistory } from "../history/useHistory";
import { withColor } from "../nodes/color";
import { motionDuration } from "../physics/motion";
import { useForceLayout } from "../physics/useForceLayout";
import { SaveIndicator } from "../scene-editor/SaveIndicator";
import { LinkPanel } from "./LinkPanel";
import { RouteEdgeView, TwoWayLinksContext, pairKey, toRouteEdge, withRouteColor, type RouteEdge } from "./RouteEdge";
import { ScenePanel } from "./ScenePanel";
import { SceneActionsContext, SceneNodeCard, ScenePreviewsContext } from "./SceneNodeCard";
import { copyScenes, pasteScenes } from "./scene-clipboard";
import { toCampaignGraph, useCampaignAutosave } from "./useCampaignAutosave";
import "../graph-canvas.css";

export type SceneNode = Node<{ name: string; color: string | null }, "scene">;

const nodeTypes: NodeTypes = { scene: SceneNodeCard };
const edgeTypes: EdgeTypes = { route: RouteEdgeView };

const defaultEdgeOptions: DefaultEdgeOptions = { animated: true };

const DELETE_KEYS = ["Backspace", "Delete"];
const notSelf = (c: { source: string; target: string }) => c.source !== c.target;
const PASTE_CASCADE = 24;

export interface CampaignGraphProps {
  campaignId: string;
  /** Initial layout; later changes only sync names and colours into the cards. */
  scenes: Scene[];
  links: SceneLink[];
  /** Scene shown in the layer above; while set the canvas is read-only and zoomed to that node. */
  openSceneId: string | null;
  /** True while the layers zoom in or out; this one sits at scale(1.06) whenever a scene is open. */
  layerMoving: boolean;
  /** Toolbar element the save dot renders into. */
  toolbarSlot: HTMLElement | null;
  /** Each scene's nodes without their data, drawn as a miniature on its card. */
  previews: Record<string, NodeOutline[]>;
  onOpenScene: (id: string, at?: { x: number; y: number }) => void;
  onPrefetchScene: (id: string) => void;
  /** A scene's nodes, for copying it. */
  onLoadSceneGraph: (id: string) => Promise<Graph>;
  onRenameScene: (id: string, name: string) => void;
  onRecolorScene: (id: string, color: string | null) => void;
  /** A pasted scene comes with the nodes it was created with. */
  onSceneCreated: (scene: Scene, graph?: Graph) => void;
  onSceneDeleted: (id: string) => void;
  onError: (message: string) => void;
}

function toNode(s: Scene): SceneNode {
  return withColor(
    {
      id: s.id,
      type: "scene",
      position: { x: s.x, y: s.y },
      data: { name: s.name, color: s.color },
    },
    s.color
  );
}

type Selection = { nodes: string[]; edge: string | null };

const NONE: Selection = { nodes: [], edge: null };

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
  previews,
  onOpenScene,
  onPrefetchScene,
  onLoadSceneGraph,
  onRenameScene,
  onRecolorScene,
  onSceneCreated,
  onSceneDeleted,
  onError,
}: CampaignGraphProps) {
  const [initial] = useState(() => ({
    nodes: scenes.map(toNode),
    edges: links.map(toRouteEdge),
  }));
  const [nodes, setNodes, onNodesChange] = useNodesState<SceneNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RouteEdge>(initial.edges);
  const [selection, setSelection] = useState<Selection>(NONE);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Offscreen scenes are skipped only once every node has been measured, or the layout would wait on them.
  const [visibleOnly, setVisibleOnly] = useState(false);
  const dragging = useRef(false);
  // The auto fitView runs once, on the initial settle; later settles would yank the camera mid-edit.
  const settled = useRef(false);
  // Camera to return to when the scene closes; "fit" when the scene opened before the first settle (deep link).
  const savedViewport = useRef<Viewport | "fit" | null>(null);
  const pastes = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const {
    screenToFlowPosition,
    flowToScreenPosition,
    deleteElements,
    fitView,
    getNode,
    getNodes,
    getEdges,
    getViewport,
    setViewport,
  } = useReactFlow<SceneNode, RouteEdge>();
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

  const layout = useForceLayout<SceneNode, RouteEdge>(nodes, edges, setNodes, {
    onEnd,
  });
  const { status, error } = useCampaignAutosave(campaignId, nodes, edges, [dragging, layout.isSimulating]);

  // Scenes are created and deleted on the server as they happen, so a step only covers the scenes
  // still present; colours go through the workspace, which owns them, as well as onto the cards.
  const history = useHistory<CampaignGraphDoc>({
    inputs: [nodes, edges],
    snapshot: () => toCampaignGraph(nodes, edges),
    holds: [dragging, layout.isSimulating],
    restore: (doc) => {
      const byId = new Map(doc.scenes.map((s) => [s.id, s]));
      const current = getNodes();
      for (const n of current) {
        const s = byId.get(n.id);
        if (s && s.color !== n.data.color) onRecolorScene(n.id, s.color);
      }
      setNodes((ns) =>
        ns.map((n) => {
          const s = byId.get(n.id);
          return s ? withColor({ ...n, position: { x: s.x, y: s.y }, data: { ...n.data, color: s.color } }, s.color) : n;
        })
      );
      const present = new Set(current.map((n) => n.id));
      setEdges(doc.links.filter((l) => present.has(l.source) && present.has(l.target)).map(toRouteEdge));
    },
    enabled: !locked,
  });

  // Zoom to the opened scene and restore the camera on close; the layer above takes all input meanwhile.
  useEffect(() => {
    if (openSceneId) {
      if (!savedViewport.current) savedViewport.current = settled.current ? getViewport() : "fit";
      void fitView({
        nodes: [{ id: openSceneId }],
        duration: motionDuration(500),
        maxZoom: 1.6,
        padding: 0.4,
      });
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
          : addEdge(withRouteColor({ ...conn, id: newId(), type: "route", label: "" }, null), eds)
      );
    },
    [setEdges]
  );

  const onSelectionChange: OnSelectionChangeFunc<SceneNode, RouteEdge> = useCallback(({ nodes: ns, edges: es }) => {
    setSelection({ nodes: ns.map((n) => n.id), edge: es[0]?.id ?? null });
    // A freshly added scene keeps its name focused until the selection moves on.
    setFocusId((id) => (ns[0]?.id === id ? id : null));
  }, []);

  const onNodeMouseEnter: NodeMouseHandler<SceneNode> = useCallback(
    (_, node) => onPrefetchScene(node.id),
    [onPrefetchScene]
  );

  // Scenes are deleted only through the confirm path; keyboard delete still removes links.
  const onBeforeDelete: OnBeforeDelete<SceneNode, RouteEdge> = useCallback(
    async ({ nodes: ns }) => ns.length === 0,
    []
  );

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

  const onNodeDoubleClick: NodeMouseHandler<SceneNode> = useCallback((_, node) => openScene(node.id), [openScene]);

  // One confirm for the whole selection; scenes are removed one by one and the rest kept on failure.
  const deleteScenes = useCallback(
    async (ids: string[]) => {
      const name = ids.length === 1 ? getNode(ids[0])?.data.name : undefined;
      if (!confirm(name !== undefined ? `Delete scene "${name}"?` : `Delete ${ids.length} scenes?`)) return;
      for (const id of ids) {
        try {
          await scenesApi.remove(id);
        } catch (err) {
          onError(err instanceof Error ? err.message : "Could not delete the scene");
          return;
        }
        setNodes((ns) => ns.filter((n) => n.id !== id));
        setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
        onSceneDeleted(id);
      }
    },
    [getNode, setNodes, setEdges, onSceneDeleted, onError]
  );

  const sceneActions = useMemo(
    () => ({
      onOpen: openScene,
      onDelete: (id: string) => void deleteScenes([id]),
    }),
    [openScene, deleteScenes]
  );

  const centre = useCallback(() => {
    const rect = container.current?.getBoundingClientRect();
    return rect
      ? screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      : { x: 0, y: 0 };
  }, [screenToFlowPosition]);

  const addScene = useCallback(async () => {
    const at = centre();
    try {
      const scene = await campaigns.createScene(campaignId, {
        name: "New scene",
        x: at.x,
        y: at.y,
      });
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
  }, [campaignId, centre, setNodes, layout.release, onSceneCreated, onError]);

  // A scene is copied with its nodes as they are now, so a later edit does not change what pastes.
  const copySelection = useCallback(async () => {
    const selected = getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    pastes.current = 0;
    try {
      const graphs = await Promise.all(selected.map((n) => onLoadSceneGraph(n.id)));
      copyScenes(
        selected.map((n, i) => ({
          id: n.id,
          name: n.data.name,
          color: n.data.color,
          x: n.position.x,
          y: n.position.y,
          graph: graphs[i],
        })),
        getEdges().map((e) => ({
          source: e.source,
          target: e.target,
          label: typeof e.label === "string" ? e.label : "",
          color: e.data?.color ?? null,
        }))
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not copy the scenes");
    }
  }, [getNodes, getEdges, onLoadSceneGraph, onError]);

  // Each scene is created empty and then given its nodes; whatever was created before a failure stays.
  const paste = useCallback(async () => {
    const at = centre();
    const step = pastes.current * PASTE_CASCADE;
    const { scenes: specs, links: copiedLinks } = pasteScenes({
      x: at.x + step,
      y: at.y + step,
    });
    if (specs.length === 0) return;
    pastes.current += 1;
    const created: Scene[] = [];
    try {
      for (const spec of specs) {
        const scene = await campaigns.createScene(campaignId, {
          name: spec.name,
          x: spec.x,
          y: spec.y,
        });
        created.push({ ...scene, color: spec.color });
        if (spec.graph.nodes.length > 0) await scenesApi.putGraph(scene.id, spec.graph);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not paste the scenes");
    }
    if (created.length === 0) return;
    setNodes((ns) => [
      ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
      ...created.map((s) => ({ ...toNode(s), selected: true })),
    ]);
    setEdges((es) => [
      ...es,
      ...copiedLinks
        .filter((l) => l.from < created.length && l.to < created.length)
        .map((l) =>
          toRouteEdge({
            id: newId(),
            source: created[l.from].id,
            target: created[l.to].id,
            label: l.label,
            color: l.color,
          })
        ),
    ]);
    layout.release(created.map((s) => s.id));
    created.forEach((s, i) => onSceneCreated(s, specs[i].graph));
  }, [campaignId, centre, setNodes, setEdges, layout.release, onSceneCreated, onError]);

  // Inputs, the side panel (.nokey) and dialogs keep their own keys.
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isInputDOMNode(e)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() === "c") void copySelection();
      else if (e.key.toLowerCase() === "v") void paste();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, copySelection, paste]);

  const updateEdgeLabel = (id: string, label: string) =>
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, label } : e)));
  const updateEdgeColor = (id: string, color: string | null) =>
    setEdges((es) => es.map((e) => (e.id === id ? withRouteColor(e, color) : e)));

  // Keyed by the link pairs alone, so selecting or recolouring a link does not re-render every edge.
  const topology = edges.map((e) => pairKey(e.source, e.target)).join("\0");
  const twoWay = useMemo(() => {
    const pairs = new Set(topology.split("\0"));
    return new Set([...pairs].filter((pair) => pairs.has(pair.split("\n").reverse().join("\n"))));
  }, [topology]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedNodes = selection.nodes.flatMap((id) => nodeById.get(id) ?? []);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
  const selectedEdge =
    selectedNodes.length === 0 && selection.edge ? edges.find((e) => e.id === selection.edge) : undefined;
  const sharedColor = selectedNodes.every((n) => n.data.color === selectedNodes[0]?.data.color)
    ? (selectedNodes[0]?.data.color ?? null)
    : null;

  return (
    <div className="graph-canvas">
      {toolbarSlot &&
        createPortal(
          <>
            <HistoryButtons {...history} />
            <SaveIndicator status={status} error={error} />
          </>,
          toolbarSlot
        )}
      <div className="graph-canvas__main">
        <div className="graph-canvas__viewport" ref={container}>
          <SceneActionsContext.Provider value={sceneActions}>
            <ScenePreviewsContext.Provider value={previews}>
              {/* Distinct id: background pattern, arrow marker and a11y ids default to "1" and would collide with the scene flow. */}
              <TwoWayLinksContext.Provider value={twoWay}>
                <ReactFlow<SceneNode, RouteEdge>
                  id="campaign"
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                isValidConnection={notSelf}
                  onSelectionChange={onSelectionChange}
                  onNodeDoubleClick={onNodeDoubleClick}
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
                  selectionOnDrag
                  selectionMode={SelectionMode.Partial}
                  panOnDrag={[1, 2]}
                  panOnScroll
                  zoomOnScroll={false}
                  zoomOnDoubleClick={false}
                  nodeClickDistance={4}
                  fitView
                  fitViewOptions={{ maxZoom: 1 }}
                >
                  <Background />
                  <Controls />
                </ReactFlow>
              </TwoWayLinksContext.Provider>
            </ScenePreviewsContext.Provider>
          </SceneActionsContext.Provider>
          <button
            type="button"
            className="canvas-fab"
            aria-label="Add scene"
            disabled={locked}
            onClick={() => void addScene()}
          >
            <Plus size={18} aria-hidden="true" /> <span>Scene</span>
          </button>
        </div>
        <SidePanel open={selectedNodes.length > 0 || !!selectedEdge}>
          {selectedNodes.length > 1 ? (
            <MultiSelectPanel
              key="multi"
              count={selectedNodes.length}
              color={sharedColor}
              onChangeColor={(color) => selectedNodes.forEach((n) => onRecolorScene(n.id, color))}
              onDelete={() => void deleteScenes(selectedNodes.map((n) => n.id))}
            />
          ) : selectedNode ? (
            <ScenePanel
              key={selectedNode.id}
              node={selectedNode}
              autoFocus={focusId === selectedNode.id}
              onRename={(name) => onRenameScene(selectedNode.id, name)}
              onChangeColor={(color) => onRecolorScene(selectedNode.id, color)}
              onOpen={() => openScene(selectedNode.id)}
              onDelete={() => void deleteScenes([selectedNode.id])}
            />
          ) : selectedEdge ? (
            <LinkPanel
              key={selectedEdge.id}
              edge={selectedEdge}
              onChangeLabel={(label) => updateEdgeLabel(selectedEdge.id, label)}
              onChangeColor={(color) => updateEdgeColor(selectedEdge.id, color)}
              onDelete={() => void deleteElements({ edges: [{ id: selectedEdge.id }] })}
            />
          ) : null}
        </SidePanel>
      </div>
    </div>
  );
}
