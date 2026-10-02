import type { CSSProperties, InputHTMLAttributes } from "react";

export interface RangeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max"> {
  value: number;
  min: number;
  max: number;
}

/** A range input drawn by our own CSS; `--fill` paints the track up to the thumb, which no browser exposes on its own. */
export function RangeInput({ value, min, max, style, ...rest }: RangeInputProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      {...rest}
      type="range"
      min={min}
      max={max}
      value={value}
      style={{ ...style, "--fill": `${fill}%` } as CSSProperties}
    />
  );
}
