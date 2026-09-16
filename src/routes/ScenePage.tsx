import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { scenes } from "../api/endpoints";
import { Spinner } from "../components/Spinner";

// Old scene links redirect into the campaign workspace.
export default function ScenePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    scenes
      .get(id)
      .then(({ scene }) => {
        if (!cancelled) navigate(`/campaigns/${scene.campaignId}/scenes/${scene.id}`, { replace: true });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load scene");
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  return (
    <div className="graph-page">
      <div className="graph-page__status">{error ? <span className="graph-canvas__danger">{error}</span> : <Spinner />}</div>
    </div>
  );
}
