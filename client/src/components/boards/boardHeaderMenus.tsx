"use client";

import { assigneeLabel, type BoardLabel, type MemberProfile } from "@/components/boards/boardCard";
import { Filter, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

const buttonClass =
  "inline-flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-black/40 border border-white/10 text-gray-200";
const panelClass =
  "absolute right-0 mt-2 z-50 min-w-56 rounded-md bg-background-alt border border-white/10 shadow-lg p-3";

function OverlayMenu({
  label,
  icon,
  active,
  children,
  onOpenChange,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={label}
        onClick={() => setMenuOpen(!open)}
        className={`${buttonClass} ${active ? "ring-1 ring-blue-400" : ""}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && <div className={panelClass}>{children}</div>}
    </div>
  );
}

export function BoardFilterMenu({
  assigneeFilter,
  labelFilter,
  labels,
  members,
  currentUserId,
  memberProfiles,
  onAssigneeChange,
  onLabelChange,
}: {
  assigneeFilter: string;
  labelFilter: string;
  labels: BoardLabel[];
  members: string[];
  currentUserId?: string;
  memberProfiles?: MemberProfile[];
  onAssigneeChange: (value: string) => void;
  onLabelChange: (value: string) => void;
}) {
  const otherMembers = members.filter((uid) => uid !== currentUserId);

  return (
    <OverlayMenu
      label="Filter"
      icon={<Filter className="w-4 h-4" />}
      active={Boolean(assigneeFilter || labelFilter)}
    >
      <div className="space-y-3 text-sm text-gray-200">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-400">
            Assigned to
          </span>
          <select
            value={assigneeFilter}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className="w-full text-sm px-2 py-1.5 rounded-md bg-black/40 border border-white/10"
          >
            <option value="">All</option>
            {currentUserId && <option value="me">Me</option>}
            {otherMembers.map((uid) => (
              <option key={uid} value={uid}>
                {assigneeLabel(uid, currentUserId, memberProfiles)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-400">
            Label
          </span>
          <select
            value={labelFilter}
            onChange={(e) => onLabelChange(e.target.value)}
            className="w-full text-sm px-2 py-1.5 rounded-md bg-black/40 border border-white/10"
          >
            <option value="">All labels</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </OverlayMenu>
  );
}

export function BoardSettingsMenu({
  onEditLabels,
  onEditMembers,
  onEditInfo,
  archiveHref,
  binHref,
  blockedVisible,
  blockedCardCount,
  onToggleBlocked,
}: {
  onEditLabels: () => void;
  onEditMembers: () => void;
  onEditInfo?: () => void;
  archiveHref?: string;
  binHref?: string;
  blockedVisible?: boolean;
  blockedCardCount?: number;
  onToggleBlocked?: (visible: boolean) => Promise<string | null>;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [blockedError, setBlockedError] = useState("");
  const [blockedSaving, setBlockedSaving] = useState(false);
  const itemClass =
    "text-left text-sm px-2 py-1.5 rounded-md text-gray-200 hover:bg-border-hover";
  const needsConfirm = Boolean(blockedVisible && (blockedCardCount || 0) > 0);

  return (
    <OverlayMenu
      label="Settings"
      icon={<Settings className="w-4 h-4" />}
      onOpenChange={(next) => {
        if (!next) {
          setConfirmRemove(false);
          setBlockedError("");
        }
      }}
    >
      <div className="flex flex-col gap-1">
        {onToggleBlocked && (
          <div className="mb-1 border-b border-white/10 pb-2">
            <label className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-sm text-gray-200 cursor-pointer hover:bg-border-hover">
              <span>Show blocked column</span>
              <input
                type="checkbox"
                checked={Boolean(blockedVisible)}
                disabled={blockedSaving}
                onChange={() => {
                  if (blockedVisible && needsConfirm && !confirmRemove) {
                    setConfirmRemove(true);
                    setBlockedError("");
                    return;
                  }
                  void (async () => {
                    setBlockedSaving(true);
                    const message = await onToggleBlocked(!blockedVisible);
                    setBlockedSaving(false);
                    setConfirmRemove(false);
                    setBlockedError(message || "");
                  })();
                }}
                className="size-4 accent-blue-500 disabled:opacity-50"
              />
            </label>
            {confirmRemove && (
              <>
                <p className="px-2 text-xs text-gray-400">
                  Cards in Blocked will move to To Do.
                </p>
                <button
                  type="button"
                  disabled={blockedSaving}
                  onClick={() => {
                    void (async () => {
                      setBlockedSaving(true);
                      const message = await onToggleBlocked(false);
                      setBlockedSaving(false);
                      setConfirmRemove(false);
                      setBlockedError(message || "");
                    })();
                  }}
                  className={`${itemClass} w-full disabled:opacity-50`}
                >
                  Move cards to To Do and remove
                </button>
              </>
            )}
            {blockedError && (
              <p className="px-2 text-xs text-red-400">{blockedError}</p>
            )}
          </div>
        )}
        {onEditInfo && (
          <button type="button" onClick={onEditInfo} className={itemClass}>
            Board info
          </button>
        )}
        <button type="button" onClick={onEditLabels} className={itemClass}>
          Edit labels
        </button>
        <button type="button" onClick={onEditMembers} className={itemClass}>
          Members
        </button>
        {archiveHref ? (
          <Link href={archiveHref} className={itemClass}>
            Archive
          </Link>
        ) : null}
        {binHref ? (
          <Link href={binHref} className={itemClass}>
            Bin
          </Link>
        ) : null}
      </div>
    </OverlayMenu>
  );
}
