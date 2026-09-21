import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Graph } from "../../shared/graph";
import type { GroupData } from "../../shared/nodes/group";
import { HistoryButtons } from "../components/HistoryButtons";
import { useHistory } from "../history/useHistory";
import type { AppNode } from "../nodes/registry";
import { NodeCanvas } from "./NodeCanvas";
import { SaveIndicator } from "./SaveIndicator";
import { fromGraph, toGraph, useAutosave } from "./useAutosave";

export interface SceneEditorProps {
  sceneId: string;
  graph: Graph;
  /** Group open inside this scene (route param), or null. */
  groupId: string | null;
  /** Toolbar element the save dot renders into (add buttons are in-canvas now). */
  toolbarSlot: HTMLElement | null;
  /** The workspace's third layer; the group canvas is portalled into it while groupId is set. */
  groupLayerSlot: HTMLElement | null;
  layerMoving: boolean;
  groupLayerMoving: boolean;
  /** Receives the final graph when the editor unmounts. */
  onUnmount: (graph: Graph) => void;
  /** Escape with nothing selected at scene level. */
  onClose: () => void;
  onOpenGroup: (id: string, at?: { x: number; y: number }) => void;
  /** Escape with nothing selected at group level, and when the open group is not in the scene. */
  onCloseGroup: () => void;
}

/** The scene document: the canvases below own placement and selection, this owns the graph. */
export function SceneEditor({
  sceneId,
  graph,
  groupId,
  toolbarSlot,
  groupLayerSlot,
  layerMoving,
  groupLayerMoving,
  onUnmount,
  onClose,
  onOpenGroup,
  onCloseGroup,
}: SceneEditorProps) {
  const [nodes, setNodes] = useState(() => fromGraph(graph.nodes));
  const [sceneHolds, setSceneHolds] = useState<RefObject<boolean>[]>([]);
  const [groupHolds, setGroupHolds] = useState<RefObject<boolean>[]>([]);
  const holds = useMemo(() => [...sceneHolds, ...groupHolds], [sceneHolds, groupHolds]);
  // A canvas reports its last nodes from its own unmount cleanup, which React runs before this
  // component's, so every write lands in the ref too: state set there would never reach onUnmount.
  const latest = useRef({ nodes, onUnmount });
  latest.current.onUnmount = onUnmount;
  const getNodes = useCallback(() => latest.current.nodes, []);
  const { status, error } = useAutosave(sceneId, nodes, getNodes, holds);
  const [revision, setRevision] = useState(0);

  const commit = useCallback((next: AppNode[]) => {
    latest.current.nodes = next;
    setNodes(next);
  }, []);

  const history = useHistory<Graph>({
    inputs: [nodes],
    snapshot: () => toGraph(getNodes()),
    holds,
    restore: (doc) => {
      commit(fromGraph(doc.nodes));
      setRevision((r) => r + 1);
    },
    enabled: !layerMoving && !groupLayerMoving,
  });

  useEffect(
    () => () => {
      const { nodes: last, onUnmount: done } = latest.current;
      done(toGraph(last));
    },
    []
  );

  // A group's children are only ever edited on the group canvas, which reports them straight here;
  // the scene canvas holds whatever copy it was last given, so its reports never overwrite them.
  const onSceneNodes = useCallback(
    (reported: AppNode[]) => {
      const mine = new Map(latest.current.nodes.map((n) => [n.id, n]));
      commit(
        reported.map((n) => {
          const kept = n.type === "group" ? mine.get(n.id)?.data.nodes : undefined;
          return kept && kept !== n.data.nodes ? { ...n, data: { ...n.data, nodes: kept } } : n;
        })
      );
    },
    [commit]
  );

  const group = groupId ? nodes.find((n) => n.id === groupId && n.type === "group") : undefined;
  const groupChildren = useMemo(() => (group ? fromGraph((group.data as GroupData).nodes) : []), [group]);

  // A group id that is not in this scene would strand its layer; drop back to the scene instead.
  useEffect(() => {
    if (groupId && !group) onCloseGroup();
  }, [groupId, group, onCloseGroup]);

  const reportChildren = useCallback(
    (children: AppNode[]) => {
      commit(
        latest.current.nodes.map((n) =>
          n.id === groupId ? { ...n, data: { ...n.data, nodes: toGraph(children).nodes } } : n
        )
      );
    },
    [groupId, commit]
  );

  return (
    <>
      {toolbarSlot &&
        createPortal(
          <>
            <HistoryButtons {...history} />
            <SaveIndicator status={status} error={error} />
          </>,
          toolbarSlot
        )}
      <NodeCanvas
        id="scene"
        initialNodes={nodes}
        revision={revision}
        allowGroups
        layerMoving={layerMoving}
        active={groupId === null}
        onNodes={onSceneNodes}
        onEscape={onClose}
        onOpenGroup={onOpenGroup}
        onHolds={setSceneHolds}
      />
      {group &&
        groupLayerSlot &&
        createPortal(
          <NodeCanvas
            key={groupId}
            id="group"
            initialNodes={groupChildren}
            revision={revision}
            allowGroups={false}
            layerMoving={groupLayerMoving}
            active
            onNodes={reportChildren}
            onEscape={onCloseGroup}
            onHolds={setGroupHolds}
          />,
          groupLayerSlot
        )}
    </>
  );
}
