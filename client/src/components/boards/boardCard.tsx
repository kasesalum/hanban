"use client";

import { isDeadlineOverdue } from "@/components/boards/deadlinePicker";
import DescriptionText from "@/components/boards/descriptionText";
import { Star } from "lucide-react";

export type BoardLabel = {
  id: string;
  name: string;
  color: string;
};

export const DEFAULT_BOARD_LABELS: BoardLabel[] = [
  { id: "Bug", name: "Bug", color: "#ef4444" },
  { id: "Feature", name: "Feature", color: "#3b82f6" },
  { id: "Chore", name: "Chore", color: "#f59e0b" },
  { id: "Idea", name: "Idea", color: "#a855f7" },
];

export function findBoardLabel(labels: BoardLabel[] | undefined, id?: string) {
  if (!id) return undefined;
  return (labels || DEFAULT_BOARD_LABELS).find((label) => label.id === id);
}

export function LabelChip({
  labelId,
  labels,
  className = "",
}: {
  labelId?: string;
  labels?: BoardLabel[];
  className?: string;
}) {
  const label = findBoardLabel(labels, labelId);
  if (!label) return null;
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${className}`}
      style={{
        backgroundColor: `${label.color}33`,
        color: label.color,
        borderColor: label.color,
      }}
    >
      {label.name}
    </span>
  );
}

export interface BoardCardData {
  id: string;
  name?: string;
  pinned?: boolean;
  background?: {
    type: "color" | "preset" | "upload";
    value: string;
  };
  description?: string;
  assignees?: string[];
  label?: string;
  deadline?: string;
}

export type MemberProfile = {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
};

export function toMemberProfileMap(
  profiles?: MemberProfile[]
): Record<string, MemberProfile> {
  const map: Record<string, MemberProfile> = {};
  for (const profile of profiles || []) {
    map[profile.uid] = profile;
  }
  return map;
}

export function assigneeLabel(
  uid: string,
  currentUserId?: string,
  profiles?: MemberProfile[] | Record<string, MemberProfile>
) {
  if (currentUserId && uid === currentUserId) return "You";
  const map = Array.isArray(profiles) ? toMemberProfileMap(profiles) : profiles;
  const profile = map?.[uid];
  const name = profile?.displayName?.trim();
  if (name) return name;
  const email = profile?.email?.trim();
  if (email) return email;
  return uid.slice(0, 6);
}

interface BoardCardProps {
  board: BoardCardData;
  togglePin?: (id: string) => void;
  openBoard?: (id: string) => void;
  onOpen?: () => void;
  currentUserId?: string;
  compact?: boolean;
  listId?: string;
  onMove?: (listId: string) => void;
  labels?: BoardLabel[];
  memberProfiles?: MemberProfile[];
}

export default function BoardCard({
  board,
  togglePin,
  openBoard,
  onOpen,
  currentUserId,
  compact = false,
  listId,
  onMove,
  labels,
  memberProfiles,
}: BoardCardProps) {
  const label = findBoardLabel(labels, board.label);
  const hasMeta =
    Boolean(label) ||
    Boolean(board.deadline) ||
    (board.assignees && board.assignees.length > 0);
  const clickable = Boolean(onOpen || openBoard);

  return (
    <div
      onClick={() => {
        if (onOpen) onOpen();
        else openBoard?.(board.id);
      }}
      className={`relative w-full rounded-xl shadow-md 
    bg-background-alt hover:bg-border-hover transition
    flex flex-col group overflow-hidden
    ${compact ? "min-w-0" : "w-44 shrink-0 h-36"}
    ${clickable ? "cursor-pointer" : ""}`}
    >
      {togglePin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePin(board.id);
          }}
          className={`absolute top-2 right-2 p-1 rounded-md 
    bg-black/40 backdrop-blur-sm transition z-10
    ${board.pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          aria-label={board.pinned ? "Unpin board" : "Pin board"}
        >
          {board.pinned ? (
            <Star
              className="w-5 h-5 text-yellow-400 fill-yellow-400 transition-transform duration-200 ease-out 
        hover:scale-120"
            />
          ) : (
            <Star
              className="w-5 h-5 text-gray-400 transition-transform duration-200 ease-out 
        hover:scale-120 hover:text-yellow-400"
            />
          )}
        </button>
      )}

      {!compact && (
        <div className="relative w-full overflow-hidden h-2/3 rounded-t-xl">
          {board.background ? (
            board.background.type === "color" ? (
              <div
                className="absolute inset-0"
                style={{ background: board.background.value }}
              />
            ) : (
              <img
                src={board.background.value}
                alt={board.name || "Board preview"}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )
          ) : (
            <img
              src="/default-board.jpg"
              alt={board.name || "Board preview"}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>
      )}

      <div
        className={`px-3 py-2 ${compact ? "space-y-2" : "h-1/3 flex items-end pb-3"}`}
      >
        <div className={`flex items-center gap-2 min-w-0 ${compact ? "" : "w-full"}`}>
          {compact && onMove && (
            <label
              className="relative group/done shrink-0 flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={listId === "done"}
                onChange={(e) => {
                  e.stopPropagation();
                  if (e.target.checked) onMove("done");
                }}
                className="size-4 appearance-none rounded-full border border-gray-400 bg-transparent
                  checked:bg-green-500 checked:border-green-500 cursor-pointer
                  hover:border-gray-200"
                aria-label="Mark as done"
              />
              <span className="pointer-events-none absolute left-full ml-1.5 whitespace-nowrap
                text-xs text-gray-200 opacity-0 group-hover/done:opacity-100 transition-opacity z-10
                px-1.5 py-0.5 rounded bg-black/70">
                Mark as done
              </span>
            </label>
          )}
          <p className="font-semibold text-lg text-white truncate min-w-0">
            {board.name || "Untitled Board"}
          </p>
        </div>
        {hasMeta && (
          <div className="space-y-1.5 pb-1">
            {!compact && board.description && (
              <p className="text-xs text-gray-400 line-clamp-2">
                <DescriptionText text={board.description} />
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              <LabelChip labelId={board.label} labels={labels} />
              {board.deadline && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    isDeadlineOverdue(board.deadline, listId)
                      ? "border-red-500 text-red-400 bg-red-500/15"
                      : "border-border text-gray-300"
                  }`}
                >
                  {isDeadlineOverdue(board.deadline, listId)
                    ? `Overdue ${board.deadline}`
                    : board.deadline}
                </span>
              )}
            </div>
            {board.assignees && board.assignees.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {board.assignees.map((uid) => (
                  <span
                    key={uid}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-gray-200"
                  >
                    {assigneeLabel(uid, currentUserId, memberProfiles)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
