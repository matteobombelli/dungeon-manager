import { useId, type ChangeEvent } from "react";
import "./file-button.css";

export interface FileButtonProps {
  accept: string;
  label: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function FileButton({ accept, label, onFile, disabled }: FileButtonProps) {
  const inputId = useId();

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset first: picking the same file again fires no change event otherwise.
    e.target.value = "";
    if (file) onFile(file);
  }

  return (
    <label className="file-button" htmlFor={inputId}>
      <input id={inputId} className="sr-only" type="file" accept={accept} onChange={pick} disabled={disabled} />
      {label}
    </label>
  );
}
