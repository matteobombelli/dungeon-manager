import { COLOR_PRESETS } from "../../shared/color";
import "./color-field.css";

export interface ColorFieldProps {
  value: string | null;
  onChange: (color: string | null) => void;
  label?: string;
}

const CUSTOM_FALLBACK = COLOR_PRESETS.find((p) => p.name === "Sky")!.light;

export function ColorField({ value, onChange, label = "Colour" }: ColorFieldProps) {
  // A preset stores one hex, so it is resolved for the scheme in use when it is picked.
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const swatch = (active: boolean, extra?: string) =>
    ["color-field__swatch", extra, active && "color-field__swatch--active"].filter(Boolean).join(" ");

  return (
    <div className="color-field">
      <span className="color-field__label">{label}</span>
      <button
        type="button"
        className={swatch(value === null, "color-field__swatch--default")}
        aria-label="Default"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      />
      {COLOR_PRESETS.map((preset) => {
        const hex = dark ? preset.dark : preset.light;
        return (
          <button
            key={preset.name}
            type="button"
            className={swatch(value?.toLowerCase() === hex)}
            style={{ background: hex }}
            aria-label={preset.name}
            aria-pressed={value?.toLowerCase() === hex}
            onClick={() => onChange(hex)}
          />
        );
      })}
      <input
        type="color"
        aria-label="Custom colour"
        value={value ?? CUSTOM_FALLBACK}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
