import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { IconButton } from "../components/IconButton";
import "./editor-section.css";

export interface EditorSectionProps {
  id: string;
  title: string;
  /** Extra controls in the title row, before the remove button. */
  actions?: ReactNode;
  onRemove?: () => void;
  children?: ReactNode;
}

export function EditorSection({ id, title, actions, onRemove, children }: EditorSectionProps) {
  return (
    <section className="editor-group" data-section={id}>
      <h4 className="editor-group__title">
        <span>{title}</span>
        {actions}
        {onRemove && <IconButton icon={X} label="Remove section" onClick={onRemove} />}
      </h4>
      {children}
    </section>
  );
}

export interface Sections<S extends string> {
  isVisible: (id: S) => boolean;
  hide: (id: S) => void;
  show: (id: S) => void;
  hiddenIds: S[];
}

/**
 * Section visibility over a node's `hiddenSections`. Nothing hidden is stored as `undefined`,
 * not `[]`, so a node whose sections were never touched keeps its original JSON.
 */
export function useSections<S extends string>(
  hidden: S[] | undefined,
  all: readonly S[],
  setHidden: (next: S[] | undefined) => void,
): Sections<S> {
  const hiddenIds = all.filter((id) => hidden?.includes(id));
  return {
    isVisible: (id) => !hiddenIds.includes(id),
    hide: (id) => setHidden([...hiddenIds, id]),
    show: (id) => {
      const next = hiddenIds.filter((h) => h !== id);
      setHidden(next.length > 0 ? next : undefined);
    },
    hiddenIds,
  };
}

export interface AddSectionMenuProps<S extends string> {
  hidden: { id: S; label: string }[];
  onAdd: (id: S) => void;
}

export function AddSectionMenu<S extends string>({ hidden, onAdd }: AddSectionMenuProps<S>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Claims the key so the scene editor's Escape (clear selection) does not fire on the same press.
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (hidden.length === 0) return null;

  return (
    <div className="section-menu" ref={root}>
      <IconButton
        icon={Plus}
        label="Add section"
        active={open}
        ariaHasPopup="menu"
        ariaExpanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul className="section-menu__list" role="menu">
          {hidden.map((s) => (
            <li key={s.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="section-menu__item"
                onClick={() => {
                  onAdd(s.id);
                  setOpen(false);
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
