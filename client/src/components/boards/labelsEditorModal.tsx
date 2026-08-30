"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { BoardLabel } from "@/components/boards/boardCard";

const SWATCHES = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
  "#6b7280",
];

interface LabelsEditorModalProps {
  open: boolean;
  labels: BoardLabel[];
  onClose: () => void;
  onSave: (labels: BoardLabel[]) => Promise<void>;
}

export default function LabelsEditorModal({
  open,
  labels,
  onClose,
  onSave,
}: LabelsEditorModalProps) {
  const [draft, setDraft] = useState<BoardLabel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(labels.map((label) => ({ ...label })));
  }, [open, labels]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

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
        <h2 className="text-xl font-semibold pr-8">Labels</h2>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {draft.map((label, index) => (
            <div key={label.id} className="flex items-center gap-2">
              <input
                value={label.name}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, name: e.target.value } : item
                    )
                  )
                }
                className="flex-1 px-3 py-2 rounded-md bg-background-alt border border-border"
              />
              <div className="flex gap-1">
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() =>
                      setDraft((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, color } : item
                        )
                      )
                    }
                    className={`size-5 rounded-full border ${
                      label.color === color ? "border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
              <input
                value={label.color}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, color: e.target.value } : item
                    )
                  )
                }
                className="w-24 px-2 py-2 rounded-md bg-background-alt border border-border text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => prev.filter((_, i) => i !== index))
                }
                className="text-red-400 text-sm"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() =>
              setDraft((prev) => [
                ...prev,
                { id: `new-${Date.now()}`, name: "New label", color: "#6b7280" },
              ])
            }
            className="flex items-center gap-1 text-sm text-gray-300 hover:text-white"
          >
            <Plus className="w-4 h-4" />
            Add label
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(
                draft.map((label) =>
                  label.id.startsWith("new-")
                    ? { name: label.name, color: label.color, id: "" }
                    : label
                )
              );
              setSaving(false);
            }}
            className="px-3 py-1 rounded-md bg-accent hover:bg-accent/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
