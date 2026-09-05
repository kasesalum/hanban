"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { assigneeLabel, type MemberProfile } from "@/components/boards/boardCard";
import { isValidEmail, searchUsers, type SearchUser } from "@/lib/helper";

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSearching(false);
      setAlreadyMember(false);
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

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      setAlreadyMember(false);
      return;
    }

    setSearching(true);
    const handle = setTimeout(async () => {
      const users = await searchUsers(q);
      const available = users.filter((user) => !members.includes(user.uid));
      setResults(available);
      setAlreadyMember(users.length > 0 && available.length === 0);
      setSearching(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [query, open, members]);

  async function addEmail(email: string) {
    if (!email || busy) return;
    setBusy(true);
    const message = await onAdd(email);
    setError(message || "");
    if (!message) {
      setQuery("");
      setResults([]);
      setAlreadyMember(false);
    }
    setBusy(false);
  }

  if (!open) return null;

  const showDropdown = query.trim().length > 0;

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
          className="relative space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const value = query.trim();
            if (!value || busy) return;
            if (results.length === 1 && results[0].email) {
              await addEmail(results[0].email);
              return;
            }
            if (isValidEmail(value)) {
              await addEmail(value);
              return;
            }
            setError("Select a user or enter an email");
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError("");
              }}
              placeholder="Search by name or email"
              autoComplete="off"
              className="flex-1 px-3 py-2 rounded-md bg-background-alt border border-border"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-2 rounded-md bg-accent hover:bg-accent/80 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {showDropdown && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-background-alt shadow-lg">
              {searching ? (
                <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>
              ) : results.length > 0 ? (
                <ul>
                  {results.map((user) => (
                    <li key={user.uid}>
                      <button
                        type="button"
                        disabled={busy || !user.email}
                        onClick={() => addEmail(user.email)}
                        className="w-full px-3 py-2 text-left hover:bg-border-hover disabled:opacity-50"
                      >
                        <p className="text-sm text-white truncate">
                          {user.displayName?.trim() || user.email}
                        </p>
                        {user.displayName?.trim() && (
                          <p className="text-xs text-gray-400 truncate">
                            {user.email}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-sm text-gray-400">
                  {alreadyMember ? "Already a member" : "No users found"}
                </p>
              )}
            </div>
          )}
        </form>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
