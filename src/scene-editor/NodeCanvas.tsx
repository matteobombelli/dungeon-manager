import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  type Edge,
  type NodeMouseHandler,
  type OnBeforeDelete,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import { isInputDOMNode } from "@xyflow/system";
import "@xyflow/react/dist/style.css";
import { newId } from "../../shared/ids";
import type { GroupData } from "../../shared/nodes/group";
import { NODE_TYPES, type NodeTypeId } from "../../shared/nodes/registry";
import { MultiSelectPanel } from "../components/MultiSelectPanel";
import { SidePanel } from "../components/SidePanel";
import { copyNodes, pasteNodes } from "../nodes/clipboard";
import { withColor } from "../nodes/color";
import { GroupActionsContext } from "../nodes/group/actions";
import { nodeTypes, type AppNode } from "../nodes/registry";
import { NODE_SHAPES } from "../nodes/shapes";
import { motionDuration } from "../physics/motion";
import { useForceLayout } from "../physics/useForceLayout";
import { AddNodeMenu } from "./AddNodeMenu";
import { NodePanel } from "./NodePanel";
import { fromGraph, toGraph } from "./useAutosave";
import "../graph-canvas.css";

export interface NodeCanvasProps {
  /** React Flow instance id; background pattern and a11y ids are scoped by it. */
  id: string;
  /**
   * The document's nodes: the canvas takes its state from them on mount, and afterwards only
   * mirrors data changed outside it (a group's children, edited on the canvas above).
   */
  initialNodes: AppNode[];
  /** Bumped when the document was replaced from outside (undo); the canvas then takes every node from initialNodes. */
  revision?: number;
  /** False inside a group: groups do not nest, so the add menu hides them and paste drops them. */
  allowGroups: boolean;
  /** True while the layer zooms in or out; the canvas is scaled by an ancestor until it is false. */
  layerMoving: boolean;
  /** Only the top-most canvas owns the delete, copy, paste and escape keys. */
  active: boolean;
  /** Called when the canvas is cold, never per simulation tick. */
  onNodes: (nodes: AppNode[]) => void;
  /** Escape with nothing selected. */
  onEscape: () => void;
  onOpenGroup?: (id: string, at?: { x: number; y: number }) => void;
  /** This canvas's in-motion refs, for the document's autosave; called once on mount. */
  onHolds?: (refs: RefObject<boolean>[]) => void;
}

const DELETE_KEYS = ["Backspace", "Delete"];
const NO_EDGES: Edge[] = [];
const PASTE_CASCADE = 24;

// Round shapes collide on their radius; the rest on the half-diagonal so corners stay clear.
function collisionRadius(node: AppNode): number {
  const w = node.measured?.width ?? 200;
  const h = node.measured?.height ?? 80;
  const shape = NODE_SHAPES[node.type];
  return shape === "circle" || shape === "pill" ? Math.max(w, h) / 2 : Math.hypot(w, h) / 2;
}

export function NodeCanvas(props: NodeCanvasProps) {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function NodeCanvasInner({
  id,
  initialNodes,
  revision = 0,
  allowGroups,
  layerMoving,
  active,
  onNodes,
  onEscape,
  onOpenGroup,
  onHolds,
}: NodeCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes);
  const [selection, setSelection] = useState<string[]>([]);
  // Which node last asked its editor to open a modal, and how many times: a repeat ask must fire again.
  const [openRequest, setOpenRequest] = useState<{ id: string; nonce: number } | null>(null);
  // Counts the moments the document has settled; the effect below reports exactly those.
  const [cold, setCold] = useState(0);
  const dragging = useRef(false);
  const pastes = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, flowToScreenPosition, deleteElements, fitView, getNode, getNodes } =
    useReactFlow<AppNode, Edge>();
  const updateNodeInternals = useUpdateNodeInternals();

  const latest = useRef(nodes);
  latest.current = nodes;
  const report = useRef(onNodes);
  report.current = onNodes;

  // The document is rebuilt from a report, so one per tick would re-render every node every frame:
  // reports happen only when the canvas is cold (layout end, drag stop, edit, add, delete, paste).
  const markCold = useCallback(() => setCold((c) => c + 1), []);
  useEffect(() => {
    if (cold > 0) report.current(latest.current);
  }, [cold]);

  // React runs a child's cleanup before its parent's, so the last report must reach the document
  // through a ref write (what `onNodes` does) rather than a state update that would never be seen.
  useEffect(
    () => () => {
      dragging.current = false;
      report.current(latest.current);
    },
    []
  );

  // Data edited on the canvas above (a group's children) reaches the cards here; positions and
  // selection stay local, and a node's own edits come back with the same data object, so they no-op.
  useEffect(() => {
    setNodes((ns) => {
      const byId = new Map(initialNodes.map((n) => [n.id, n]));
      let changed = false;
      const out = ns.map((n) => {
        const next = byId.get(n.id);
        if (!next || next.data === n.data) return n;
        changed = true;
        return { ...n, data: next.data };
      });
      return changed ? out : ns;
    });
  }, [initialNodes, setNodes]);

  // An undo replaces placement too; selection and measurements carry over by id and nothing is released to the layout.
  const applied = useRef(revision);
  useEffect(() => {
    if (revision === applied.current) return;
    applied.current = revision;
    setNodes((ns) => {
      const before = new Map(ns.map((n) => [n.id, n]));
      return initialNodes.map((n) => {
        const was = before.get(n.id);
        return was ? { ...n, selected: was.selected, measured: was.measured } : n;
      });
    });
  }, [revision, initialNodes, setNodes]);

  // Nodes are measured against the unscaled container, so their sizes are only valid at scale 1.
  useEffect(() => {
    if (!layerMoving) updateNodeInternals(getNodes().map((n) => n.id));
  }, [layerMoving, getNodes, updateNodeInternals]);

  // Only the load-time settle re-fits the view; later settles would yank the camera mid-edit.
  const settledOnce = useRef(false);
  const onEnd = useCallback(() => {
    markCold();
    if (settledOnce.current) return;
    settledOnce.current = true;
    // With nothing to place the layout settles inside its own layout effect, before React Flow has painted.
    requestAnimationFrame(() => void fitView({ duration: motionDuration(300), maxZoom: 1 }));
  }, [fitView, markCold]);

  const layout = useForceLayout<AppNode, Edge>(nodes, NO_EDGES, setNodes, { radius: collisionRadius, onEnd });

  useEffect(() => {
    onHolds?.([layout.isSimulating, dragging]);
  }, [onHolds, layout.isSimulating]);

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
      markCold();
    },
    [layout.onNodeDragStop, markCold]
  );

  const onSelectionChange: OnSelectionChangeFunc<AppNode, Edge> = useCallback(({ nodes: ns }) => {
    const ids = ns.map((n) => n.id);
    setSelection(ids);
    // The request belongs to one node's editor: once the selection leaves it, a later re-select
    // must not replay it (the editor remounts and would act on the stale nonce).
    setOpenRequest((r) => (r && ids.length === 1 && ids[0] === r.id ? r : null));
  }, []);

  // A group takes its children with it, so emptying one that still has some asks first.
  const onBeforeDelete: OnBeforeDelete<AppNode, Edge> = useCallback(async ({ nodes: ns }) => {
    const full = ns.filter((n) => n.type === "group" && (n.data as GroupData).nodes.length > 0);
    if (full.length === 0) return true;
    const one = full[0].data as GroupData;
    return confirm(
      full.length === 1
        ? `Delete "${NODE_TYPES.group.titleOf(one)}" and its ${one.nodes.length} nodes?`
        : `Delete ${full.length} groups and their nodes?`
    );
  }, []);

  // Deleting a node mid-drag ends the drag without a stop event.
  const onNodesDelete: OnNodesDelete<AppNode> = useCallback(() => {
    dragging.current = false;
    markCold();
  }, [markCold]);

  // The layer above grows out of the card's centre on screen.
  const openGroup = useCallback(
    (nodeId: string) => {
      const node = getNode(nodeId);
      const at = node?.measured?.width
        ? flowToScreenPosition({
            x: node.position.x + node.measured.width / 2,
            y: node.position.y + (node.measured.height ?? 0) / 2,
          })
        : undefined;
      onOpenGroup?.(nodeId, at);
    },
    [getNode, flowToScreenPosition, onOpenGroup]
  );

  const onNodeDoubleClick: NodeMouseHandler<AppNode> = useCallback(
    (_, node) => {
      if (node.type === "group") openGroup(node.id);
      // The map editor lives in the panel, so the card asks it to open its modal.
      else if (node.type === "map") setOpenRequest((r) => ({ id: node.id, nonce: (r?.id === node.id ? r.nonce : 0) + 1 }));
    },
    [openGroup]
  );

  const groupActions = useMemo(() => ({ onOpen: openGroup }), [openGroup]);

  const centre = useCallback(() => {
    const rect = container.current?.getBoundingClientRect();
    return rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
  }, [screenToFlowPosition]);

  const addNode = useCallback(
    (type: NodeTypeId, data: Record<string, unknown>) => {
      const at = centre();
      const nodeId = newId();
      setNodes((ns) => {
        // Cascade successive additions so new nodes don't stack on the same point.
        const offset = (ns.length % 8) * 32;
        const position = { x: at.x + offset, y: at.y + offset };
        return [
          ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
          withColor({ id: nodeId, type, position, data, selected: true }, null),
        ];
      });
      layout.release([nodeId]);
      markCold();
    },
    [centre, setNodes, layout.release, markCold]
  );

  const copySelection = useCallback(() => {
    copyNodes(toGraph(getNodes().filter((n) => n.selected)).nodes);
    pastes.current = 0;
  }, [getNodes]);

  const paste = useCallback(() => {
    const at = centre();
    const step = pastes.current * PASTE_CASCADE;
    const pasted = fromGraph(pasteNodes({ x: at.x + step, y: at.y + step }, allowGroups));
    if (pasted.length === 0) return;
    pastes.current += 1;
    setNodes((ns) => [
      ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
      ...pasted.map((n) => ({ ...n, selected: true })),
    ]);
    layout.release(pasted.map((n) => n.id));
    markCold();
  }, [centre, allowGroups, setNodes, layout.release, markCold]);

  // Escape clears the selection, or closes this layer when nothing is selected. Inputs, the side
  // panel (.nokey) and dialogs keep their own keys, and so does the add menu (it preventDefaults).
  useEffect(() => {
    if (!active || layerMoving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isInputDOMNode(e)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "Escape") {
        if (getNodes().some((n) => n.selected)) setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)));
        else onEscape();
        return;
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() === "c") copySelection();
      else if (e.key.toLowerCase() === "v") paste();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, layerMoving, getNodes, setNodes, onEscape, copySelection, paste]);

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data } : n)));
      markCold();
    },
    [setNodes, markCold]
  );

  const updateColor = useCallback(
    (ids: string[], color: string | null) => {
      setNodes((ns) => ns.map((n) => (ids.includes(n.id) ? withColor(n, color) : n)));
      markCold();
    },
    [setNodes, markCold]
  );

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selected = selection.flatMap((sel) => nodeById.get(sel) ?? []);
  const single = selected.length === 1 ? selected[0] : undefined;
  const sharedColor = selected.every((n) => n.color === selected[0]?.color) ? selected[0]?.color ?? null : null;

  return (
    <GroupActionsContext.Provider value={groupActions}>
      <div className="graph-canvas">
        <div className="graph-canvas__main">
          <div className="graph-canvas__viewport" ref={container}>
            <ReactFlow<AppNode, Edge>
              id={id}
              nodes={nodes}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onSelectionChange={onSelectionChange}
              onNodeDoubleClick={onNodeDoubleClick}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={layout.onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onBeforeDelete={onBeforeDelete}
              onNodesDelete={onNodesDelete}
              nodesConnectable={false}
              // React Flow's key listeners live on document, so they follow the same gate as ours.
              deleteKeyCode={active && !layerMoving ? DELETE_KEYS : null}
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
            <AddNodeMenu onAdd={addNode} allowGroups={allowGroups} up />
          </div>
          <SidePanel open={selected.length > 0}>
            {selected.length > 1 ? (
              <MultiSelectPanel
                key="multi"
                count={selected.length}
                color={sharedColor}
                onChangeColor={(color) => updateColor(selected.map((n) => n.id), color)}
                onDelete={() => void deleteElements({ nodes: selected.map((n) => ({ id: n.id })) })}
              />
            ) : single ? (
              <NodePanel
                key={single.id}
                node={single}
                openRequest={openRequest?.id === single.id ? openRequest.nonce : 0}
                onChange={(data) => updateNodeData(single.id, data)}
                onChangeColor={(color) => updateColor([single.id], color)}
                onDelete={() => void deleteElements({ nodes: [{ id: single.id }] })}
              />
            ) : null}
          </SidePanel>
        </div>
      </div>
    </GroupActionsContext.Provider>
  );
}
