import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { PrefabCreate, type Prefab } from "../../shared/api";
import { slugifyKey as slugify, type PrefabField, type PrefabFieldKind } from "../../shared/prefab";
import { prefabs as api } from "../api/endpoints";
import { IconButton } from "../components/IconButton";
import { Modal } from "../components/Modal";
import { relativeTime } from "../components/relativeTime";
import { Spinner } from "../components/Spinner";

const KINDS: PrefabFieldKind[] = ["text", "number", "image"];

interface Draft {
  id: string | null;
  name: string;
  fields: PrefabField[];
}

const emptyDraft = (): Draft => ({ id: null, name: "", fields: [{ key: "", label: "", kind: "text" }] });

export default function PrefabsPage() {
  const [items, setItems] = useState<Prefab[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [issues, setIssues] = useState<{ path: PropertyKey[]; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .list()
      .then(setItems)
      .catch((err: Error) => {
        setItems([]);
        setError(err.message);
      });
  }, []);

  function setField(index: number, patch: Partial<PrefabField>) {
    setDraft((d) =>
      d ? { ...d, fields: d.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) } : d
    );
  }

  function edit(p: Prefab) {
    setIssues([]);
    setDraft({ id: p.id, name: p.name, fields: p.fields.map((f) => ({ ...f })) });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const fields = draft.fields.map((f) => ({ ...f, key: f.key.trim() || slugify(f.label) }));
    const parsed = PrefabCreate.safeParse({ name: draft.name, fields });
    if (!parsed.success) {
      setIssues(parsed.error.issues.map((i) => ({ path: [...i.path], message: i.message })));
      return;
    }
    setIssues([]);
    setBusy(true);
    setError(null);
    try {
      if (draft.id) {
        const updated = await api.update(draft.id, parsed.data);
        setItems((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await api.create(parsed.data);
        setItems((prev) => [created, ...(prev ?? [])]);
      }
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the prefab");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(prefab: Prefab) {
    if (!confirm(`Delete prefab "${prefab.name}"?`)) return;
    try {
      await api.remove(prefab.id);
      setItems((prev) => (prev ?? []).filter((p) => p.id !== prefab.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the prefab");
    }
  }

  const issuesAt = (...prefix: PropertyKey[]) =>
    issues.filter((i) => prefix.every((p, n) => i.path[n] === p));

  return (
    <main className="page">
      {error && <p className="form__error">{error}</p>}
      {items === null ? (
        <Spinner />
      ) : (
        <ul className="card-grid">
          {items.map((p) => (
            <li className="card card--custom hover-actions" key={p.id}>
              <button type="button" className="card__title" onClick={() => edit(p)}>
                {p.name}
              </button>
              <p className="card__desc">{p.fields.map((f) => `${f.label} (${f.kind})`).join(", ")}</p>
              <span className="card__meta">{relativeTime(p.updatedAt)}</span>
              <div className="card__actions">
                <IconButton icon={Trash2} label="Delete" danger onClick={() => void onDelete(p)} />
              </div>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="card card--add"
              aria-label="New prefab"
              onClick={() => {
                setIssues([]);
                setDraft(emptyDraft());
              }}
            >
              <Plus size={28} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </li>
        </ul>
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit prefab" : "New prefab"}
      >
        {draft && (
          <form className="form" onSubmit={onSubmit}>
            <input
              aria-label="Name"
              placeholder="Name"
              required
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {issuesAt("name").map((i, n) => (
              <p className="form__error" key={n}>
                {i.message}
              </p>
            ))}

            <div className="prefab-fields">
              {draft.fields.map((field, index) => (
                <div className="prefab-fields__row" key={index}>
                  <input
                    aria-label="Label"
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => setField(index, { label: e.target.value })}
                  />
                  <input
                    aria-label="Key"
                    placeholder={slugify(field.label) || "key"}
                    value={field.key}
                    onChange={(e) => setField(index, { key: e.target.value })}
                  />
                  <select
                    aria-label="Kind"
                    value={field.kind}
                    onChange={(e) => setField(index, { kind: e.target.value as PrefabFieldKind })}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <IconButton
                    icon={X}
                    label="Remove field"
                    onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })}
                  />
                  {issuesAt("fields", index).map((i, n) => (
                    <p className="form__error prefab-fields__error" key={n}>
                      {String(i.path[2] ?? "field")}: {i.message}
                    </p>
                  ))}
                </div>
              ))}
              {issues
                .filter((i) => i.path[0] === "fields" && typeof i.path[1] !== "number")
                .map((i, n) => (
                  <p className="form__error" key={n}>
                    {i.message}
                  </p>
                ))}
              <div>
                <IconButton
                  icon={Plus}
                  label="Add field"
                  onClick={() => setDraft({ ...draft, fields: [...draft.fields, { key: "", label: "", kind: "text" }] })}
                />
              </div>
            </div>

            <div className="form__actions">
              <button type="submit" className="button--primary" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}
