"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { assigneeLabel, type MemberProfile } from "@/components/boards/boardCard";

interface MembersModalProps {
  open: boolean;
  members: string[];
  ownerId?: string;
  currentUserId?: string;
  memberProfiles?: MemberProfile[];
  onClose: () => void;
  onAdd: (email: string) => Promise<string | null>;
  onRemove: (uid: string) => Promise<string | null>;
}

export default function MembersModal({
  open,
  members,
  ownerId,
  currentUserId,
  memberProfiles,
  onClose,
  onAdd,
  onRemove,
}: MembersModalProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setError("");
    }
  }, [open]);

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
        <h2 className="text-xl font-semibold pr-8">Members</h2>
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {members.map((uid) => (
            <li
              key={uid}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>
                {assigneeLabel(uid, currentUserId, memberProfiles)}
                {uid === ownerId ? " (owner)" : ""}
              </span>
              {uid !== ownerId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const message = await onRemove(uid);
                    setError(message || "");
                    setBusy(false);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!email.trim() || busy) return;
            setBusy(true);
            const message = await onAdd(email.trim());
            setError(message || "");
            if (!message) setEmail("");
            setBusy(false);
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Add by email"
            required
            className="flex-1 px-3 py-2 rounded-md bg-background-alt border border-border"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-3 py-2 rounded-md bg-accent hover:bg-accent/80 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
