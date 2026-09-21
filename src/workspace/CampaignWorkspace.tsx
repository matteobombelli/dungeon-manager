import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Campaign, Scene, SceneLink } from "../../shared/api";
import type { Graph, NodeOutline } from "../../shared/graph";
import type { GroupData } from "../../shared/nodes/group";
import { NODE_TYPES } from "../../shared/nodes/registry";
import { scenes as scenesApi } from "../api/endpoints";
import { AudioPlayerProvider } from "../audio/AudioPlayerProvider";
import { CampaignGraph } from "../campaign-graph/CampaignGraph";
import { IconButton } from "../components/IconButton";
import { transitionMs, usePresence } from "../components/SidePanel";
import { Spinner } from "../components/Spinner";
import { SceneEditor } from "../scene-editor/SceneEditor";
import { useSceneCache } from "./useSceneCache";
import "./workspace.css";

export interface CampaignWorkspaceProps {
  campaign: Campaign;
  scenes: Scene[];
  links: SceneLink[];
  /** Each scene's nodes without their data, for the card miniatures. */
  previews: Record<string, NodeOutline[]>;
}

// Layers grow out of the card they were opened from, in workspace coordinates.
function originAt(root: HTMLElement | null, at?: { x: number; y: number }): string | undefined {
  const rect = root?.getBoundingClientRect();
  return at && rect ? `${at.x - rect.left}px ${at.y - rect.top}px` : undefined;
}

/**
 * One page per campaign: the campaign canvas stays mounted underneath while a scene, chosen by the
 * `sceneId` route param, zooms in as a layer on top, and a group inside it (`groupId`) as a third.
 */
export function CampaignWorkspace({ campaign, scenes: initialScenes, links, previews: initialPreviews }: CampaignWorkspaceProps) {
  const { sceneId, groupId } = useParams();
  const navigate = useNavigate();
  const [scenes, setScenes] = useState(initialScenes);
  const [previews, setPreviews] = useState(initialPreviews);
  const [error, setError] = useState<string | null>(null);
  const [campaignTools, setCampaignTools] = useState<HTMLElement | null>(null);
  const [sceneTools, setSceneTools] = useState<HTMLElement | null>(null);
  const [groupLayerSlot, setGroupLayerSlot] = useState<HTMLDivElement | null>(null);
  const [origin, setOrigin] = useState<string>();
  const [groupOrigin, setGroupOrigin] = useState<string>();
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const sceneLayer = useRef<HTMLDivElement>(null);
  const groupLayer = useRef<HTMLDivElement>(null);
  const { present, moving } = usePresence(!!sceneId, sceneLayer);
  const { present: groupPresent, moving: groupMoving } = usePresence(!!groupId, groupLayer);
  const setGroupLayer = useCallback((el: HTMLDivElement | null) => {
    groupLayer.current = el;
    setGroupLayerSlot(el);
  }, []);
  // Each layer keeps showing its last content while it zooms out after the URL has dropped it.
  const lastSceneId = useRef(sceneId);
  if (sceneId) lastSceneId.current = sceneId;
  const shownId = sceneId ?? lastSceneId.current;
  const lastGroupId = useRef(groupId);
  if (groupId) lastGroupId.current = groupId;
  const shownGroupId = (groupPresent && (groupId ?? lastGroupId.current)) || null;
  const cache = useSceneCache();
  const { load, prefetch, read, forget } = cache;

  useEffect(() => {
    if (sceneId) load(sceneId);
  }, [sceneId, load]);

  const openScene = useCallback(
    (id: string, at?: { x: number; y: number }) => {
      setOrigin(originAt(root.current, at));
      navigate(`/campaigns/${campaign.id}/scenes/${id}`);
    },
    [navigate, campaign.id]
  );
  const closeScene = useCallback(() => navigate(`/campaigns/${campaign.id}`), [navigate, campaign.id]);

  const openGroup = useCallback(
    (id: string, at?: { x: number; y: number }) => {
      setGroupOrigin(originAt(root.current, at));
      navigate(`/campaigns/${campaign.id}/scenes/${sceneId}/groups/${id}`);
    },
    [navigate, campaign.id, sceneId]
  );
  // The route's segments are independent, so a group can be addressed without a scene; drop to the
  // campaign in that case rather than building a URL with an undefined scene in it.
  const closeGroup = useCallback(
    () =>
      navigate(sceneId ? `/campaigns/${campaign.id}/scenes/${sceneId}` : `/campaigns/${campaign.id}`, {
        replace: true,
      }),
    [navigate, campaign.id, sceneId]
  );

  // Leaving the campaign fades the whole workspace out first.
  useEffect(() => {
    if (!leaving || !root.current) return;
    const timer = setTimeout(() => navigate("/campaigns"), transitionMs(root.current));
    return () => clearTimeout(timer);
  }, [leaving, navigate]);

  function goBack() {
    if (groupId) closeGroup();
    else if (sceneId) closeScene();
    else setLeaving(true);
  }

  const renameScene = useCallback(async (id: string, name: string) => {
    try {
      const scene = await scenesApi.update(id, { name });
      setScenes((ss) => ss.map((s) => (s.id === id ? scene : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  }, []);

  // Colour lives on the campaign graph document; the canvas syncs it from `scenes` and autosaves it.
  const recolorScene = useCallback(
    (id: string, color: string | null) => setScenes((ss) => ss.map((s) => (s.id === id ? { ...s, color } : s))),
    []
  );

  // A pasted scene arrives with its nodes, so its miniature does not wait for the scene to be opened.
  const onSceneCreated = useCallback((scene: Scene, graph?: Graph) => {
    setScenes((ss) => [...ss, scene]);
    if (graph) setPreviews((p) => ({ ...p, [scene.id]: graph.nodes.map(({ id, type, x, y, color }) => ({ id, type, x, y, color })) }));
  }, []);
  const onSceneDeleted = useCallback(
    (id: string) => {
      setScenes((ss) => ss.filter((s) => s.id !== id));
      setPreviews(({ [id]: _, ...rest }) => rest);
      forget(id);
      if (id === sceneId) closeScene();
    },
    [forget, sceneId, closeScene]
  );

  const shownScene = sceneId ? scenes.find((s) => s.id === sceneId) : undefined;
  const entry = shownId ? cache.get(shownId) : undefined;
  const loadError = shownId ? cache.errorOf(shownId) : undefined;
  const groupNode = groupId ? entry?.graph.nodes.find((n) => n.id === groupId && n.type === "group") : undefined;
  const groupName = groupNode ? NODE_TYPES.group.titleOf(groupNode.data as GroupData) : "Group";

  // While the scene is loading or failed there is no SceneEditor, and it owns Escape.
  const stranded = !!sceneId && !entry;
  useEffect(() => {
    if (!stranded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closeScene();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stranded, closeScene]);

  // Every crumb but the last navigates to its level.
  const crumbs = [
    { label: "Campaigns", go: () => setLeaving(true) },
    { label: campaign.name, go: closeScene },
    ...(sceneId ? [{ label: shownScene?.name ?? "Scene", go: closeGroup }] : []),
    ...(groupId ? [{ label: groupName, go: undefined }] : []),
  ];

  const classes = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");
  const sceneLayerClasses = classes(
    "workspace__layer workspace__layer--scene",
    !sceneId && "workspace__layer--leaving",
    moving && "workspace__layer--moving",
    !!groupId && "workspace__layer--behind"
  );
  const groupLayerClasses = classes(
    "workspace__layer workspace__layer--group",
    !groupId && "workspace__layer--leaving",
    groupMoving && "workspace__layer--moving"
  );

  return (
    <AudioPlayerProvider>
      <div className="graph-canvas__toolbar">
        <IconButton icon={ArrowLeft} label="Back" onClick={goBack} />
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className={classes("workspace__crumb", i > 1 && "workspace__fade")} aria-hidden="true">
                ›
              </span>
            )}
            {i === crumbs.length - 1 ? (
              <span className={classes("crumb crumb--current", i > 1 && "workspace__fade")}>{crumb.label}</span>
            ) : (
              <button type="button" className={classes("crumb", i > 1 && "workspace__fade")} onClick={crumb.go}>
                {crumb.label}
              </button>
            )}
          </Fragment>
        ))}
        {error && <span className="graph-canvas__hint graph-canvas__danger">{error}</span>}
        <span ref={setCampaignTools} className="workspace__tools" hidden={!!sceneId} />
        <span ref={setSceneTools} className="workspace__tools" hidden={!sceneId} />
      </div>
      <div className={classes("workspace", leaving && "workspace--leaving")} ref={root}>
        <div className={`workspace__layer${sceneId ? " workspace__layer--behind" : ""}`} data-layer="campaign" inert={!!sceneId}>
          <CampaignGraph
            campaignId={campaign.id}
            scenes={scenes}
            links={links}
            openSceneId={sceneId ?? null}
            layerMoving={moving}
            toolbarSlot={campaignTools}
            previews={previews}
            onOpenScene={openScene}
            onPrefetchScene={prefetch}
            onLoadSceneGraph={read}
            onRenameScene={renameScene}
            onRecolorScene={recolorScene}
            onSceneCreated={onSceneCreated}
            onSceneDeleted={onSceneDeleted}
            onError={setError}
          />
        </div>
        {present && shownId && (
          <div
            ref={sceneLayer}
            className={sceneLayerClasses}
            data-layer="scene"
            inert={moving || !!groupId}
            style={{ "--origin": origin } as CSSProperties}
          >
            {entry ? (
              // Keyed by scene: useDocumentAutosave's key-change cleanup snapshots through the already
              // updated options, so a reused editor would flush the new scene's graph to the old URL.
              <SceneEditor
                key={shownId}
                sceneId={shownId}
                graph={entry.graph}
                groupId={shownGroupId}
                toolbarSlot={sceneTools}
                groupLayerSlot={groupLayerSlot}
                layerMoving={moving}
                groupLayerMoving={groupMoving}
                // The editor is the only place a scene's nodes change, so its close refreshes the card miniature.
                onUnmount={(graph) => {
                  cache.store(shownId, graph);
                  setPreviews((p) => ({ ...p, [shownId]: graph.nodes.map(({ id, type, x, y, color }) => ({ id, type, x, y, color })) }));
                }}
                onClose={closeScene}
                onOpenGroup={openGroup}
                onCloseGroup={closeGroup}
              />
            ) : (
              <div className="workspace__status">{loadError ? <span className="graph-canvas__danger">{loadError}</span> : <Spinner />}</div>
            )}
          </div>
        )}
        {groupPresent && (
          <div
            ref={setGroupLayer}
            className={groupLayerClasses}
            data-layer="group"
            inert={groupMoving}
            style={{ "--origin": groupOrigin } as CSSProperties}
          >
            {groupId && !entry && (
              <div className="workspace__status">
                {loadError ? <span className="graph-canvas__danger">{loadError}</span> : <Spinner />}
              </div>
            )}
          </div>
        )}
      </div>
    </AudioPlayerProvider>
  );
}
