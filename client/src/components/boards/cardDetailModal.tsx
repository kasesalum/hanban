"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MessageSquare, Plus, X } from "lucide-react";
import {
  LabelChip,
  assigneeLabel,
  type BoardLabel,
  type MemberProfile,
} from "@/components/boards/boardCard";
import DescriptionText from "@/components/boards/descriptionText";
import DeadlinePicker, { isDeadlineOverdue } from "@/components/boards/deadlinePicker";

export type CardComment = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
};

export type CardActivity = {
  id: string;
  userId: string;
  type: string;
  text: string;
  createdAt: string;
};

export type DetailCard = {
  id: string;
  title: string;
  description?: string;
  assignees?: string[];
  label?: string;
  deadline?: string;
  comments?: CardComment[];
  activity?: CardActivity[];
};

interface CardDetailModalProps {
  open: boolean;
  card: DetailCard | null;
  listId: string;
  lists: { id: string; title: string }[];
  labels?: BoardLabel[];
  members?: string[];
  currentUserId?: string;
  memberProfiles?: MemberProfile[];
  onClose: () => void;
  onMove: (listId: string) => void;
  onUpdate: (fields: {
    title?: string;
    description?: string;
    assignees?: string[];
    label?: string;
    deadline?: string;
  }) => Promise<void>;
  onComment: (text: string) => Promise<void>;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function memberDisplayName(
  uid: string,
  currentUserId?: string,
  profiles?: MemberProfile[]
) {
  const profile = profiles?.find((item) => item.uid === uid);
  const name = profile?.displayName?.trim();
  if (name) return name;
  const email = profile?.email?.trim();
  if (email) return email;
  return assigneeLabel(uid, currentUserId, profiles);
}

function Avatar({
  uid,
  profiles,
  currentUserId,
}: {
  uid: string;
  profiles?: MemberProfile[];
  currentUserId?: string;
}) {
  const name = memberDisplayName(uid, currentUserId, profiles);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ left: number; top: number } | null>(null);
  const profile = profiles?.find((item) => item.uid === uid);

  function showTip() {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      left: rect.left + rect.width / 2,
      top: rect.bottom + 6,
    });
  }

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onMouseEnter={showTip}
      onMouseLeave={() => setTip(null)}
    >
      {profile?.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.photoURL}
          alt={name}
          className="w-7 h-7 rounded-full object-cover border border-border"
        />
      ) : (
        <span className="w-7 h-7 rounded-full bg-indigo-500/80 text-white text-[10px] font-semibold flex items-center justify-center">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {tip &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[200] -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-xs text-gray-100 shadow-lg"
            style={{ left: tip.left, top: tip.top }}
          >
            {name}
          </span>,
          document.body
        )}
    </span>
  );
}

export default function CardDetailModal({
  open,
  card,
  listId,
  lists,
  labels = [],
  members = [],
  currentUserId,
  memberProfiles,
  onClose,
  onMove,
  onUpdate,
  onComment,
}: CardDetailModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [comment, setComment] = useState("");
  const [hideDetails, setHideDetails] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const membersRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description || "");
    setEditingDescription(false);
    setComment("");
  }, [card?.id, card?.title, card?.description]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        membersRef.current &&
        !membersRef.current.contains(event.target as Node)
      ) {
        setMembersOpen(false);
      }
      if (labelsRef.current && !labelsRef.current.contains(event.target as Node)) {
        setLabelsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const feed = useMemo(() => {
    const activity = [...(card?.activity || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (hideDetails) return activity.filter((item) => item.type === "comment");
    return activity;
  }, [card?.activity, hideDetails]);

  if (!open || !card) return null;

  async function save(fields: Parameters<typeof onUpdate>[0]) {
    setBusy(true);
    await onUpdate(fields);
    setBusy(false);
  }

  async function handleTitleBlur() {
    const next = title.trim();
    if (!next || next === card.title) {
      setTitle(card.title);
      return;
    }
    await save({ title: next });
  }

  async function handleDescriptionBlur() {
    setEditingDescription(false);
    if ((description.trim() || "") === (card.description || "")) return;
    await save({ description: description.trim() });
  }

  async function handleComment(event: FormEvent) {
    event.preventDefault();
    const text = comment.trim();
    if (!text || busy) return;
    setBusy(true);
    await onComment(text);
    setComment("");
    setBusy(false);
  }

  const assignees = card.assignees || [];
  const overdue = isDeadlineOverdue(card.deadline, listId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-background shadow-xl border border-border flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
          <select
            value={listId}
            onChange={(e) => onMove(e.target.value)}
            className="text-xs uppercase tracking-wide px-2 py-1 rounded-md bg-background-alt border border-border text-gray-200"
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="p-5 space-y-5">
            <div className="flex items-start gap-3">
              <button
                type="button"
                title={listId === "done" ? "Mark incomplete" : "Mark complete"}
                disabled={busy}
                onClick={() => onMove(listId === "done" ? "todo" : "done")}
                className={`mt-1 size-5 shrink-0 rounded-full border flex items-center justify-center ${
                  listId === "done"
                    ? "border-green-400 bg-green-500/20 text-green-400"
                    : "border-gray-400 text-transparent hover:border-white"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="flex-1 text-xl font-semibold bg-transparent border-0 text-white focus:outline-none focus:ring-1 focus:ring-white/20 rounded-md px-1 py-0.5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-400">
                  Members
                </p>
                <div className="relative" ref={membersRef}>
                  <div className="flex flex-wrap items-center gap-1">
                    {assignees.map((uid) => (
                      <Avatar
                        key={uid}
                        uid={uid}
                        profiles={memberProfiles}
                        currentUserId={currentUserId}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setMembersOpen((prev) => !prev)}
                      className="size-7 rounded-full border border-dashed border-border text-gray-300 hover:text-white flex items-center justify-center"
                      aria-label="Add member"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {membersOpen && (
                    <div className="absolute z-20 mt-2 w-56 rounded-md border border-border bg-background-alt p-2 shadow-xl max-h-48 overflow-y-auto">
                      {members.map((uid) => {
                        const checked = assignees.includes(uid);
                        return (
                          <label
                            key={uid}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-200 hover:bg-border-hover"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy}
                              onChange={() => {
                                const next = checked
                                  ? assignees.filter((id) => id !== uid)
                                  : [...assignees, uid];
                                save({ assignees: next });
                              }}
                            />
                            {assigneeLabel(uid, currentUserId, memberProfiles)}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-400">
                  Labels
                </p>
                <div className="relative" ref={labelsRef}>
                  <div className="flex flex-wrap items-center gap-1">
                    {card.label ? (
                      <LabelChip
                        labelId={card.label}
                        labels={labels}
                        className="text-xs px-2 py-1"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setLabelsOpen((prev) => !prev)}
                      className="size-7 rounded-md border border-dashed border-border text-gray-300 hover:text-white flex items-center justify-center"
                      aria-label="Edit label"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {labelsOpen && (
                    <div className="absolute z-20 mt-2 w-48 rounded-md border border-border bg-background-alt p-2 shadow-xl">
                      <button
                        type="button"
                        className="block w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-border-hover text-gray-300"
                        onClick={() => {
                          save({ label: "" });
                          setLabelsOpen(false);
                        }}
                      >
                        No label
                      </button>
                      {labels.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="flex w-full items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md hover:bg-border-hover"
                          onClick={() => {
                            save({ label: item.id });
                            setLabelsOpen(false);
                          }}
                        >
                          <LabelChip
                            labelId={item.id}
                            labels={labels}
                            className="text-[10px] px-1.5 py-0.5"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-400">
                  Due date
                </p>
                <div className="flex items-center gap-2">
                  <DeadlinePicker
                    value={card.deadline || ""}
                    allowClear
                    onChange={(deadline) => save({ deadline })}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm ${
                      overdue
                        ? "border-red-500 text-red-400 bg-red-500/10"
                        : "border-border bg-background-alt text-gray-100"
                    }`}
                  />
                  {overdue && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-red-500 text-red-400 bg-red-500/15">
                      Overdue
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm text-gray-400">Description</p>
              {editingDescription ? (
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  placeholder="Add a more detailed description..."
                  rows={5}
                  className="w-full px-3 py-2 rounded-md bg-background-alt border border-border text-sm text-gray-100 resize-y"
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditingDescription(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setEditingDescription(true);
                    }
                  }}
                  className="w-full text-left min-h-24 px-3 py-2 rounded-md bg-background-alt border border-border text-sm text-gray-200 whitespace-pre-wrap cursor-text"
                >
                  {card.description?.trim() ? (
                    <DescriptionText text={card.description} />
                  ) : (
                    <span className="text-gray-500">
                      Add a more detailed description...
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="border-t md:border-t-0 md:border-l border-border p-4 bg-background-alt/40 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments and activity
              </h3>
              <button
                type="button"
                onClick={() => setHideDetails((prev) => !prev)}
                className="text-xs text-gray-400 hover:text-white"
              >
                {hideDetails ? "Show details" : "Hide details"}
              </button>
            </div>

            <form onSubmit={handleComment}>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm text-gray-100 resize-none"
              />
              <button
                type="submit"
                disabled={busy || !comment.trim()}
                className="mt-2 px-3 py-1.5 rounded-md bg-accent hover:bg-accent/80 text-sm disabled:opacity-50"
              >
                Save
              </button>
            </form>

            <ul className="space-y-3 overflow-y-auto flex-1 min-h-0">
              {feed.length === 0 ? (
                <li className="text-sm text-gray-500">No activity yet.</li>
              ) : (
                feed.map((item) => (
                  <li key={item.id} className="flex gap-2 text-sm">
                    <Avatar
                      uid={item.userId}
                      profiles={memberProfiles}
                      currentUserId={currentUserId}
                    />
                    <div className="min-w-0">
                      <p className="text-gray-200">
                        <span className="font-medium text-white">
                          {assigneeLabel(
                            item.userId,
                            currentUserId,
                            memberProfiles
                          )}
                        </span>{" "}
                        {item.type === "comment" ? (
                          <span className="text-gray-300">commented</span>
                        ) : (
                          item.text
                        )}
                      </p>
                      {item.type === "comment" && (
                        <p className="mt-1 text-gray-200 whitespace-pre-wrap">
                          {item.text}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-blue-400">
                        {formatTime(item.createdAt)}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
