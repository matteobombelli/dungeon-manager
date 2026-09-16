import { useState } from "react";
import type { StatblockData } from "../../../shared/nodes/statblock";
import { ImportError, importMonster } from "../../../shared/nodes/statblock-import";
import { Modal } from "../../components/Modal";

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: StatblockData) => void;
}

export function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const submit = () => {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      setError(`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    try {
      onImport(importMonster(raw));
    } catch (e) {
      setError(e instanceof ImportError ? e.message : `Import failed: ${String(e)}`);
      return;
    }
    setText("");
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Import monster JSON">
      <div className="form">
        <p className="muted">
          Paste a monster from the 5e SRD API (dnd5eapi.co), Open5e v1 (/v1/monsters) or Open5e v2 (/v2/creatures).
          Importing replaces every field of this stat block.
        </p>
        <textarea
          className="statblock__import-text"
          value={text}
          spellCheck={false}
          placeholder='{ "index": "goblin", ... }'
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p className="form__error">{error}</p>}
        <div className="form__actions">
          <button type="button" className="button--primary" onClick={submit} disabled={text.trim() === ""}>
            Import
          </button>
        </div>
      </div>
    </Modal>
  );
}
