import { useEffect, useState, type InputHTMLAttributes } from "react";

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max" | "onChange"> {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/**
 * An integer input that may be empty while it is being retyped. Writing a fallback the moment the
 * field is cleared would snap it back (DC 15, backspace twice, type 8: "18"), so an empty field
 * commits nothing and shows the stored value again on blur.
 */
export function NumberInput({ value, min, max, onChange, onBlur, ...rest }: NumberInputProps) {
  const [text, setText] = useState(String(value));
  // Follows outside changes (undo, another editor) without clobbering what is being typed.
  useEffect(() => setText((t) => (t.trim() !== "" && Number(t) === value ? t : String(value))), [value]);

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = Math.round(Number(raw));
        if (raw.trim() === "" || !Number.isFinite(n)) return;
        const clamped = Math.min(max, Math.max(min, n));
        if (clamped !== n) setText(String(clamped));
        if (clamped !== value) onChange(clamped);
      }}
      onBlur={(e) => {
        setText(String(value));
        onBlur?.(e);
      }}
    />
  );
}
