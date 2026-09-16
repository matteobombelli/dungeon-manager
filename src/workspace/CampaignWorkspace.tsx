import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Trash2, X } from "lucide-react";
import type { Campaign, CampaignUpdate, Prefab, Scene, SceneLink } from "../../shared/api";
import { campaigns as campaignsApi, scenes as scenesApi } from "../api/endpoints";
import { AudioPlayerProvider } from "../audio/AudioPlayerProvider";
import { CampaignGraph } from "../campaign-graph/CampaignGraph";
import { IconButton } from "../components/IconButton";
import { usePresence } from "../components/SidePanel";
import { Spinner } from "../components/Spinner";
import { SceneEditor } from "../scene-editor/SceneEditor";
import { InlineField } from "./InlineField";
import { SceneColorMenu } from "./SceneColorMenu";
import { useSceneCache } from "./useSceneCache";
import "./workspace.css";

export interface CampaignWorkspaceProps {
  campaign: Campaign;
  scenes: Scene[];
  links: SceneLink[];
  prefabs: Prefab[];
}

/**
 * One page per campaign: the campaign canvas stays mounted underneath while a scene, chosen by the
 * `sceneId` route param, zooms in as a layer on top.
 */
export function CampaignWorkspace(props: CampaignWorkspaceProps) {
  const { sceneId } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(props.campaign);
  const [scenes, setScenes] = useState(props.scenes);
  const [prefabs, setPrefabs] = useState(props.prefabs);
  const [error, setError] = useState<string | null>(null);
  const [campaignTools, setCampaignTools] = useState<HTMLElement | null>(null);
  const [sceneTools, setSceneTools] = useState<HTMLElement | null>(null);
  const [origin, setOrigin] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const sceneLayer = useRef<HTMLDivElement>(null);
  const { present, moving } = usePresence(!!sceneId, sceneLayer);
  // The layer keeps showing the last scene while it zooms out after the URL has dropped it.
  const lastSceneId = useRef(sceneId);
  if (sceneId) lastSceneId.current = sceneId;
  const shownId = sceneId ?? lastSceneId.current;
  const cache = useSceneCache(sceneId);
  const { load, forget } = cache;

  useEffect(() => {
    if (sceneId) load(sceneId);
  }, [sceneId, load]);

  const openScene = useCallback(
    (id: string, at?: { x: number; y: number }) => {
      const rect = root.current?.getBoundingClientRect();
      setOrigin(at && rect ? `${at.x - rect.left}px ${at.y - rect.top}px` : undefined);
      navigate(`/campaigns/${campaign.id}/scenes/${id}`);
    },
    [navigate, campaign.id]
  );

  const closeScene = useCallback(() => navigate(`/campaigns/${campaign.id}`), [navigate, campaign.id]);

  async function saveCampaign(patch: CampaignUpdate) {
    try {
      setCampaign(await campaignsApi.update(campaign.id, patch));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the campaign");
    }
  }

  async function deleteCampaign() {
    if (!confirm(`Delete "${campaign.name}" and all of its scenes?`)) return;
    try {
      await campaignsApi.remove(campaign.id);
      navigate("/campaigns", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the campaign");
    }
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

  const onSceneCreated = useCallback((scene: Scene) => setScenes((ss) => [...ss, scene]), []);
  const onSceneDeleted = useCallback(
    (id: string) => {
      setScenes((ss) => ss.filter((s) => s.id !== id));
      forget(id);
      if (id === sceneId) closeScene();
    },
    [forget, sceneId, closeScene]
  );
  const onPrefabCreated = useCallback((prefab: Prefab) => setPrefabs((ps) => [...ps, prefab]), []);
  const onPrefabUpdated = useCallback(
    (prefab: Prefab) => setPrefabs((ps) => ps.map((p) => (p.id === prefab.id ? prefab : p))),
    []
  );

  const shownScene = sceneId ? scenes.find((s) => s.id === sceneId) : undefined;
  const entry = shownId ? cache.get(shownId) : undefined;
  const loadError = shownId ? cache.errorOf(shownId) : undefined;

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

  const layerClasses = ["workspace__layer workspace__layer--scene", !sceneId && "workspace__layer--leaving", moving && "workspace__layer--moving"]
    .filter(Boolean)
    .join(" ");

  return (
    <AudioPlayerProvider>
      <div className="graph-canvas__toolbar">
        <IconButton icon={ArrowLeft} label="Campaigns" onClick={() => navigate("/campaigns")} />
        <InlineField
          className="inline-edit inline-edit--title"
          label="Campaign name"
          value={campaign.name}
          required
          onCommit={(name) => void saveCampaign({ name })}
        />
        {sceneId ? (
          <>
            <span className="workspace__crumb workspace__fade" aria-hidden="true">
              ›
            </span>
            <InlineField
              key={sceneId}
              className="inline-edit inline-edit--title workspace__fade"
              label="Scene name"
              value={shownScene?.name ?? ""}
              required
              onCommit={(name) => void renameScene(sceneId, name)}
            />
            <SceneColorMenu value={shownScene?.color ?? null} onChange={(color) => recolorScene(sceneId, color)} />
            <IconButton icon={X} label="Close scene" onClick={closeScene} />
          </>
        ) : (
          <InlineField
            className="inline-edit workspace__description workspace__fade"
            label="Campaign description"
            placeholder="Description"
            value={campaign.description}
            maxLength={2000}
            onCommit={(description) => void saveCampaign({ description })}
          />
        )}
        {error && <span className="graph-canvas__hint graph-canvas__danger">{error}</span>}
        <span ref={setCampaignTools} className="workspace__tools" hidden={!!sceneId} />
        <span ref={setSceneTools} className="workspace__tools" hidden={!sceneId} />
        {!sceneId && (
          <div className="workspace__end workspace__fade">
            <IconButton icon={Trash2} label="Delete campaign" danger onClick={() => void deleteCampaign()} />
          </div>
        )}
      </div>
      <div className="workspace" ref={root}>
        <div className={`workspace__layer${sceneId ? " workspace__layer--behind" : ""}`} data-layer="campaign" inert={!!sceneId}>
          <CampaignGraph
            campaignId={campaign.id}
            scenes={scenes}
            links={props.links}
            openSceneId={sceneId ?? null}
            layerMoving={moving}
            toolbarSlot={campaignTools}
            onOpenScene={openScene}
            onPrefetchScene={cache.prefetch}
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
            className={layerClasses}
            data-layer="scene"
            inert={moving}
            style={{ "--origin": origin } as CSSProperties}
          >
            {entry ? (
              // Keyed by scene: useDocumentAutosave's key-change cleanup snapshots through the already
              // updated options, so a reused editor would flush the new scene's graph to the old URL.
              <SceneEditor
                key={shownId}
                sceneId={shownId}
                graph={entry.graph}
                prefabs={prefabs}
                toolbarSlot={sceneTools}
                layerMoving={moving}
                onUnmount={(graph) => cache.store(shownId, graph)}
                onClose={closeScene}
                onPrefabCreated={onPrefabCreated}
                onPrefabUpdated={onPrefabUpdated}
              />
            ) : (
              <div className="workspace__status">{loadError ? <span className="graph-canvas__danger">{loadError}</span> : <Spinner />}</div>
            )}
          </div>
        )}
      </div>
    </AudioPlayerProvider>
  );
}
