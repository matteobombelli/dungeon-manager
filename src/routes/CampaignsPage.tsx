import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Link } from "react-router";
import type { Campaign } from "../../shared/api";
import { campaigns as api } from "../api/endpoints";
import { IconButton } from "../components/IconButton";
import { relativeTime } from "../components/relativeTime";
import { Spinner } from "../components/Spinner";

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .list()
      .then(setItems)
      .catch((err: Error) => {
        setItems([]);
        setError(err.message);
      });
  }, []);

  function cancelAdd() {
    setAdding(false);
    setName("");
  }

  async function onCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      cancelAdd();
      return;
    }
    setError(null);
    try {
      const created = await api.create({ name: trimmed, description: "" });
      setItems((prev) => [created, ...(prev ?? [])]);
      cancelAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the campaign");
    }
  }

  async function onDelete(campaign: Campaign) {
    if (!confirm(`Delete "${campaign.name}" and all of its scenes?`)) return;
    try {
      await api.remove(campaign.id);
      setItems((prev) => (prev ?? []).filter((c) => c.id !== campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the campaign");
    }
  }

  return (
    <main className="page">
      {error && <p className="form__error">{error}</p>}
      {items === null ? (
        <Spinner />
      ) : (
        <ul className="card-grid">
          {items.map((c) => (
            <li className="card card--scene hover-actions" key={c.id}>
              <Link className="card__title" to={`/campaigns/${c.id}`}>
                {c.name}
              </Link>
              {c.description && <p className="card__desc">{c.description}</p>}
              <span className="card__meta">{relativeTime(c.updatedAt)}</span>
              <div className="card__actions">
                <IconButton icon={Trash2} label="Delete" danger onClick={() => void onDelete(c)} />
              </div>
            </li>
          ))}
          <li>
            {adding ? (
              <div className="card card--add">
                <input
                  className="inline-edit"
                  aria-label="Campaign name"
                  placeholder="Campaign name"
                  maxLength={120}
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onCreate();
                    if (e.key === "Escape") cancelAdd();
                  }}
                  onBlur={() => {
                    if (!name.trim()) cancelAdd();
                  }}
                />
              </div>
            ) : (
              <button type="button" className="card card--add" aria-label="New campaign" onClick={() => setAdding(true)}>
                <Plus size={28} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </li>
        </ul>
      )}
    </main>
  );
}
