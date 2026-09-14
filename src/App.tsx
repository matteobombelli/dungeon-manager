import { useEffect, useState } from "react";

type Health = { ok: boolean; d1: boolean; r2: boolean };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Relative so it resolves under the /projects/dungeon-manager/ base.
    fetch("api/health")
      .then((res) => res.json() as Promise<Health>)
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main>
      <h1>Hello World</h1>
      <p>Dungeon Manager is deployed.</p>
      {error && <p className="status error">API error: {error}</p>}
      {health && (
        <ul className="status">
          <li>D1: {health.d1 ? "connected" : "unavailable"}</li>
          <li>R2: {health.r2 ? "connected" : "unavailable"}</li>
        </ul>
      )}
    </main>
  );
}
