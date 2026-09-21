import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router";
import type { Campaign, CampaignUpdate } from "../../shared/api";
import { campaigns as api } from "../api/endpoints";
import { IconButton } from "../components/IconButton";
import { relativeTime } from "../components/relativeTime";
import { Spinner } from "../components/Spinner";

// Name and description inputs; one save when focus leaves the card or on Enter, Escape discards.
function CampaignEditor({ campaign, onSave, onDone }: { campaign: Campaign; onSave: (patch: CampaignUpdate) => void; onDone: () => void }) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);

  function commit() {
    const patch = { name: name.trim() || campaign.name, description: description.trim() };
    if (patch.name !== campaign.name || patch.description !== campaign.description) onSave(patch);
    onDone();
  }

  return (
    <div
      className="card__edit"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onDone();
      }}
    >
      <input
        className="inline-edit"
        aria-label="Campaign name"
        maxLength={120}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="inline-edit"
        aria-label="Campaign description"
        placeholder="Description"
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </div>
  );
}

// Trashed campaigns, most recently deleted first. Nothing purges them, so the list only shrinks here.
function TrashList({ items, onRestore, onDestroy }: { items: Campaign[]; onRestore: (c: Campaign) => void; onDestroy: (c: Campaign) => void }) {
  if (items.length === 0) return <p className="muted">Deleted campaigns stay here until you delete them for good.</p>;
  return (
    <ul className="card-grid">
      {items.map((c) => (
        <li className="card card--scene" key={c.id}>
          <span className="card__name">{c.name}</span>
          {c.description && <p className="card__desc">{c.description}</p>}
          {c.deletedAt !== null && <span className="card__meta">Deleted {relativeTime(c.deletedAt)}</span>}
          <div className="card__buttons">
            <button type="button" className="chip" onClick={() => onRestore(c)}>
              Restore
            </button>
            <button type="button" className="chip" onClick={() => onDestroy(c)}>
              Delete forever
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [tab, setTab] = useState<"campaigns" | "trash">("campaigns");
  const [trash, setTrash] = useState<Campaign[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
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

  // The trash is read every time its tab is opened, so it never shows a stale list.
  useEffect(() => {
    if (tab !== "trash") return;
    setTrash(null);
    api
      .trash()
      .then(setTrash)
      .catch((err: Error) => {
        setTrash([]);
        setError(err.message);
      });
  }, [tab]);

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

  async function onUpdate(id: string, patch: CampaignUpdate) {
    try {
      const updated = await api.update(id, patch);
      setItems((prev) => (prev ?? []).map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the campaign");
    }
  }

  async function onDelete(campaign: Campaign) {
    if (!confirm(`Delete "${campaign.name}"? It moves to Recently deleted, with all of its scenes.`)) return;
    try {
      await api.remove(campaign.id);
      setItems((prev) => (prev ?? []).filter((c) => c.id !== campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the campaign");
    }
  }

  async function onRestore(campaign: Campaign) {
    try {
      const restored = await api.restore(campaign.id);
      setTrash((prev) => (prev ?? []).filter((c) => c.id !== campaign.id));
      setItems((prev) => [restored, ...(prev ?? [])].sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore the campaign");
    }
  }

  async function onDestroy(campaign: Campaign) {
    if (!confirm(`Delete "${campaign.name}" and all of its scenes for good? This cannot be undone.`)) return;
    try {
      await api.destroy(campaign.id);
      setTrash((prev) => (prev ?? []).filter((c) => c.id !== campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the campaign");
    }
  }

  return (
    <main className="page">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tabs__tab" aria-selected={tab === "campaigns"} onClick={() => setTab("campaigns")}>
          Campaigns
        </button>
        <button type="button" role="tab" className="tabs__tab" aria-selected={tab === "trash"} onClick={() => setTab("trash")}>
          Recently deleted
        </button>
      </div>
      {error && <p className="form__error">{error}</p>}
      {tab === "trash" ? (
        trash === null ? (
          <Spinner />
        ) : (
          <TrashList items={trash} onRestore={(c) => void onRestore(c)} onDestroy={(c) => void onDestroy(c)} />
        )
      ) : items === null ? (
        <Spinner />
      ) : (
        <ul className="card-grid">
          {items.map((c) => (
            <li className="card card--scene hover-actions" key={c.id}>
              {editingId === c.id ? (
                <CampaignEditor campaign={c} onSave={(patch) => void onUpdate(c.id, patch)} onDone={() => setEditingId(null)} />
              ) : (
                <>
                  <Link className="card__title" to={`/campaigns/${c.id}`}>
                    {c.name}
                  </Link>
                  {c.description && <p className="card__desc">{c.description}</p>}
                </>
              )}
              <span className="card__meta">{relativeTime(c.updatedAt)}</span>
              <div className="card__actions">
                <IconButton icon={Pencil} label="Edit" onClick={() => setEditingId(c.id)} />
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
