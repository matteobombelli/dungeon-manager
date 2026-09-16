import { useState } from "react";
import { X } from "lucide-react";
import { assets } from "../api/endpoints";
import { FileButton } from "./FileButton";
import { IconButton } from "./IconButton";

export interface ImageFieldProps {
  label?: string;
  assetId: string | null;
  onChange: (assetId: string | null) => void;
}

export function ImageField({ label = "Image", assetId, onChange }: ImageFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const asset = await assets.upload(file);
      setBroken(false);
      onChange(asset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-field">
      <span className="image-field__label">{label}</span>
      {assetId && !broken ? (
        <img className="image-field__preview" src={assets.url(assetId)} alt="" onError={() => setBroken(true)} />
      ) : (
        <div className="image-field__placeholder">{assetId ? "Image unavailable" : "No image"}</div>
      )}
      <div className="editor-actions">
        <FileButton
          accept="image/png,image/jpeg,image/webp,image/gif"
          label={assetId ? "Replace image" : "Choose image"}
          onFile={upload}
          disabled={uploading}
        />
        {assetId && <IconButton icon={X} label="Remove image" onClick={() => onChange(null)} disabled={uploading} />}
      </div>
      {uploading && <span className="image-field__status">Uploading…</span>}
      {error && <span className="form__error">{error}</span>}
    </div>
  );
}
