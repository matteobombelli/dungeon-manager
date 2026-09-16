import { useEffect, useState } from "react";

// Borderless text input that commits on blur/Enter and reverts on Escape.
export function InlineField({
  value,
  onCommit,
  label,
  className,
  placeholder,
  required,
  maxLength = 120,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  className: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit() {
    const next = draft.trim();
    if (next === value || (required && !next)) {
      setDraft(value);
      return;
    }
    onCommit(next);
  }

  return (
    <input
      className={className}
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
