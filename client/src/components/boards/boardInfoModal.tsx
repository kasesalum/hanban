"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BoardInfoModalProps {
  open: boolean;
  info: string;
  onClose: () => void;
  onSave: (info: string) => Promise<string | null>;
}

export default function BoardInfoModal({
  open,
  info,
  onClose,
  onSave,
}: BoardInfoModalProps) {
  const [draft, setDraft] = useState(info);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(info);
      setError("");
    }
  }, [open, info]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-background p-6 shadow-xl border border-border space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold pr-8">Board info</h2>
        <p className="text-sm text-gray-400">
          Shown when someone clicks or hovers the info icon next to the board
          name. Leave blank to hide the icon.
        </p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={8}
          maxLength={2000}
          placeholder="Add a short description or rules for this board..."
          className="w-full px-3 py-2 rounded-md bg-background-alt border border-border text-sm text-gray-100 resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{draft.length}/2000</span>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const message = await onSave(draft);
              setError(message || "");
              setSaving(false);
              if (!message) onClose();
            }}
            className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent/80 text-sm disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
