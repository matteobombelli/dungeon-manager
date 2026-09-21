import { useEffect, useState } from "react";
import { useParams } from "react-router";
import type { Campaign, Scene, SceneLink } from "../../shared/api";
import type { NodeOutline } from "../../shared/graph";
import { campaigns as campaignsApi } from "../api/endpoints";
import { Spinner } from "../components/Spinner";
import { CampaignWorkspace } from "../workspace/CampaignWorkspace";

type Loaded = { campaign: Campaign; scenes: Scene[]; links: SceneLink[]; previews: Record<string, NodeOutline[]> };

// Loads once per campaign; the `sceneId` param is the workspace's concern and never refetches.
export default function CampaignPage() {
  const { id = "" } = useParams();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError(null);
    campaignsApi
      .get(id)
      .then((r) => {
        if (!cancelled) setLoaded(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load campaign");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="graph-page">
      {loaded ? (
        <CampaignWorkspace {...loaded} />
      ) : (
        <div className="graph-page__status">
          {error ? <span className="graph-canvas__danger">{error}</span> : <Spinner />}
        </div>
      )}
    </div>
  );
}
