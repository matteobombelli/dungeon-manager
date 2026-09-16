import { useEffect, useRef, useState } from "react";
import { ColorField } from "../components/ColorField";
import "./scene-color-menu.css";

export interface SceneColorMenuProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

/** Swatch in the breadcrumb that opens the scene colour picker, so the open scene can be recoloured without leaving it. */
export function SceneColorMenu({ value, onChange }: SceneColorMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="scene-color nokey" ref={root}>
      <button
        type="button"
        className={`scene-color__swatch${value ? "" : " scene-color__swatch--default"}`}
        style={value ? { background: value } : undefined}
        aria-label="Scene colour"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="scene-color__popover" role="dialog" aria-label="Scene colour">
          <ColorField value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
