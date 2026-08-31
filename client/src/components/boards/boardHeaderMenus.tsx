"use client";

import { assigneeLabel, type BoardLabel } from "@/components/boards/boardCard";
import { Filter, Settings } from "lucide-react";
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
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
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
        onClick={() => setOpen((prev) => !prev)}
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
  onAssigneeChange,
  onLabelChange,
}: {
  assigneeFilter: string;
  labelFilter: string;
  labels: BoardLabel[];
  members: string[];
  currentUserId?: string;
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
                {assigneeLabel(uid, currentUserId)}
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
}: {
  onEditLabels: () => void;
  onEditMembers: () => void;
}) {
  return (
    <OverlayMenu label="Settings" icon={<Settings className="w-4 h-4" />}>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onEditLabels}
          className="text-left text-sm px-2 py-1.5 rounded-md text-gray-200 hover:bg-border-hover"
        >
          Edit labels
        </button>
        <button
          type="button"
          onClick={onEditMembers}
          className="text-left text-sm px-2 py-1.5 rounded-md text-gray-200 hover:bg-border-hover"
        >
          Members
        </button>
      </div>
    </OverlayMenu>
  );
}
