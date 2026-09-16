import { useState } from "react";
import { X } from "lucide-react";
import { assets } from "../api/endpoints";
import { FileButton } from "./FileButton";
import { IconButton } from "./IconButton";
import "./audio-field.css";

const ACCEPT = "audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/webm,audio/flac";

export interface AudioFieldProps {
  label?: string;
  assetId: string | null;
  onChange: (assetId: string | null) => void;
}

export function AudioField({ label = "Audio", assetId, onChange }: AudioFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const asset = await assets.upload(file);
      onChange(asset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="audio-field">
      <span className="audio-field__label">{label}</span>
      {assetId ? (
        <audio className="audio-field__preview" controls preload="metadata" src={assets.url(assetId)} />
      ) : (
        <div className="audio-field__placeholder">No audio</div>
      )}
      <div className="editor-actions">
        <FileButton
          accept={ACCEPT}
          label={assetId ? "Replace audio" : "Choose audio"}
          onFile={upload}
          disabled={uploading}
        />
        {assetId && <IconButton icon={X} label="Remove audio" onClick={() => onChange(null)} disabled={uploading} />}
      </div>
      {uploading && <span className="audio-field__status">Uploading…</span>}
      {error && <span className="form__error">{error}</span>}
    </div>
  );
}
