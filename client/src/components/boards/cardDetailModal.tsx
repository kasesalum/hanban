"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  LabelChip,
  assigneeLabel,
  type BoardLabel,
  type MemberProfile,
} from "@/components/boards/boardCard";
import { isDeadlineOverdue } from "@/components/boards/deadlinePicker";

export type DetailCard = {
  id: string;
  title: string;
  description?: string;
  assignees?: string[];
  label?: string;
  deadline?: string;
};

interface CardDetailModalProps {
  open: boolean;
  card: DetailCard | null;
  listId: string;
  lists: { id: string; title: string }[];
  labels?: BoardLabel[];
  currentUserId?: string;
  memberProfiles?: MemberProfile[];
  onClose: () => void;
  onMove: (listId: string) => void;
}

export default function CardDetailModal({
  open,
  card,
  listId,
  lists,
  labels,
  currentUserId,
  memberProfiles,
  onClose,
  onMove,
}: CardDetailModalProps) {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!open || !card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl bg-background p-6 shadow-xl border border-border space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold pr-8">{card.title}</h2>

        <label className="block text-sm">
          <span className="block mb-1 text-gray-400">Status</span>
          <select
            value={listId}
            onChange={(e) => onMove(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-background-alt border border-border text-gray-100"
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-1 text-sm text-gray-400">Description</p>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">
            {card.description?.trim() || "No description"}
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm text-gray-400">Label</p>
          {card.label ? (
            <LabelChip labelId={card.label} labels={labels} className="text-xs px-2 py-1" />
          ) : (
            <p className="text-sm text-gray-500">None</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm text-gray-400">Deadline</p>
          {card.deadline ? (
            <div className="flex items-center gap-2">
              <p
                className={`text-sm ${
                  isDeadlineOverdue(card.deadline, listId)
                    ? "text-red-400"
                    : "text-gray-200"
                }`}
              >
                {card.deadline}
              </p>
              {isDeadlineOverdue(card.deadline, listId) && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-red-500 text-red-400 bg-red-500/15">
                  Overdue
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-200">None</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm text-gray-400">Assignees</p>
          {card.assignees && card.assignees.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {card.assignees.map((uid) => (
                <span
                  key={uid}
                  className="text-xs px-2 py-1 rounded-full bg-background-alt border border-border"
                >
                  {assigneeLabel(uid, currentUserId, memberProfiles)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Unassigned</p>
          )}
        </div>
      </div>
    </div>
  );
}
