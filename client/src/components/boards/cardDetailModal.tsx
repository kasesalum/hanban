"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MessageSquare, Plus, Trash2, X } from "lucide-react";
import {
  LabelChip,
  assigneeLabel,
  cardLabelIds,
  type BoardLabel,
  type MemberProfile,
} from "@/components/boards/boardCard";
import DescriptionText from "@/components/boards/descriptionText";
import DeadlinePicker, {
  isDeadlineOverdue,
  tomorrowISO,
} from "@/components/boards/deadlinePicker";
import RichTextEditor, {
  RichTextHtml,
  isEmptyHtml,
  looksLikeHtml,
  type RichAttachment,
} from "@/components/boards/richTextEditor";
import { getCardFeed, uploadCardImage } from "@/lib/helper";

export type CardComment = {
  id: string;
  userId: string;
  html?: string;
  text?: string;
  attachments?: RichAttachment[];
  createdAt: string;
};

export type CardActivity = {
  id: string;
  userId: string;
  type: string;
  text: string;
  commentId?: string;
  createdAt: string;
};

export type DetailCard = {
  id: string;
  title: string;
  description?: string;
  descriptionAttachments?: RichAttachment[];
  assignees?: string[];
  labels?: string[];
  label?: string;
  deadline?: string;
  createdAt?: string;
  comments?: CardComment[];
  activity?: CardActivity[];
};

type CardFields = {
  title?: string;
  description?: string;
  descriptionAttachments?: RichAttachment[];
  assignees?: string[];
  labels?: string[];
  deadline?: string;
};

interface CardDetailModalProps {
  open: boolean;
  boardId?: string;
  card: DetailCard | null;
  listId: string;
  lists: { id: string; title: string }[];
  labels?: BoardLabel[];
  members?: string[];
  currentUserId?: string;
  memberProfiles?: MemberProfile[];
  isNew?: boolean;
  onClose: () => void;
  onMove: (listId: string) => void;
  onUpdate: (fields: CardFields) => Promise<void>;
  onCreate?: (fields: {
    title: string;
    description?: string;
    assignees?: string[];
    labels?: string[];
    deadline?: string;
  }) => Promise<boolean>;
  onComment: (html: string, attachments: RichAttachment[]) => Promise<void>;
  onDelete: () => Promise<void>;
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
  boardId,
  card,
  listId,
  lists,
  labels = [],
  members = [],
  currentUserId,
  memberProfiles,
  isNew = false,
  onClose,
  onMove,
  onUpdate,
  onCreate,
  onComment,
  onDelete,
}: CardDetailModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAttachments, setDescriptionAttachments] = useState<
    RichAttachment[]
  >([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [comment, setComment] = useState("");
  const [commentAttachments, setCommentAttachments] = useState<RichAttachment[]>(
    []
  );
  const [commentKey, setCommentKey] = useState(0);
  const [hideDetails, setHideDetails] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [feedComments, setFeedComments] = useState<CardComment[]>([]);
  const [feedActivity, setFeedActivity] = useState<CardActivity[]>([]);
  const membersRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const creatingRef = useRef(false);
  const persistedRef = useRef(!isNew);
  const skipHydrateLabelsRef = useRef(false);
  const selectedLabelsRef = useRef<string[]>([]);
  const saveChainRef = useRef(Promise.resolve());
  const titleRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description || "");
    setDescriptionAttachments(card.descriptionAttachments || []);
    setAssignees(card.assignees || []);
    if (skipHydrateLabelsRef.current) {
      skipHydrateLabelsRef.current = false;
    } else {
      const ids = cardLabelIds(card);
      selectedLabelsRef.current = ids;
      setSelectedLabels(ids);
    }
    setDeadline(card.deadline || (isNew ? tomorrowISO() : ""));
    setEditingDescription(false);
    setComment("");
    setCommentAttachments([]);
    setCommentKey((key) => key + 1);
    setConfirmDelete(false);
    creatingRef.current = false;
    persistedRef.current = !isNew;
  }, [card?.id, isNew]);

  useEffect(() => {
    if (open && isNew) {
      const frame = requestAnimationFrame(() => titleRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open, isNew, card?.id]);

  useEffect(() => {
    if (!open || !card?.id || isNew || !boardId) {
      setFeedComments([]);
      setFeedActivity([]);
      return;
    }
    let cancelled = false;
    getCardFeed(boardId, card.id).then((data) => {
      if (cancelled || !data) return;
      setFeedComments(data.comments || []);
      setFeedActivity(data.activity || []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, boardId, card?.id, isNew]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

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
    const activity = [...feedActivity].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const visible = hideDetails
      ? activity.filter((item) => item.type === "comment")
      : activity;
    return visible.map((item) => {
      if (item.type !== "comment") return { ...item, html: undefined as string | undefined };
      const comment =
        (item.commentId &&
          feedComments.find((entry) => entry.id === item.commentId)) ||
        feedComments.find((entry) => entry.createdAt === item.createdAt);
      return {
        ...item,
        html: comment?.html || comment?.text || item.text,
      };
    });
  }, [feedActivity, feedComments, hideDetails]);

  if (!open || !card || !mounted) return null;
  const currentCard = card;

  function hasDraftContent(fields?: CardFields) {
    const nextTitle = (fields?.title ?? title).trim();
    const nextDescription = fields?.description ?? description;
    const nextAssignees = fields?.assignees ?? assignees;
    const nextLabelIds = fields?.labels ?? selectedLabels;
    const nextDeadline = fields?.deadline ?? deadline;
    const initialDeadline = currentCard.deadline || tomorrowISO();
    return (
      Boolean(nextTitle) ||
      !isEmptyHtml(nextDescription) ||
      nextAssignees.length > 0 ||
      nextLabelIds.length > 0 ||
      Boolean(nextDeadline && nextDeadline !== initialDeadline)
    );
  }

  async function persist(payload: CardFields): Promise<boolean> {
    if (!persistedRef.current) {
      if (!hasDraftContent(payload) || !onCreate) return false;
      creatingRef.current = true;
      skipHydrateLabelsRef.current = true;
      const created = await onCreate({
        title: (payload.title ?? title).trim() || "Untitled",
        description: payload.description ?? description,
        assignees: payload.assignees ?? assignees,
        labels: payload.labels ?? selectedLabelsRef.current,
        deadline: payload.deadline ?? deadline,
      });
      creatingRef.current = false;
      if (created) persistedRef.current = true;
      else skipHydrateLabelsRef.current = false;
      return created;
    }

    setBusy(true);
    await onUpdate({
      ...payload,
      labels: payload.labels ?? selectedLabelsRef.current,
    });
    const cardId = currentCard.id;
    if (boardId && cardId && persistedRef.current && !cardId.startsWith("__new__")) {
      const data = await getCardFeed(boardId, cardId);
      if (data) {
        setFeedComments(data.comments || []);
        setFeedActivity(data.activity || []);
      }
    }
    setBusy(false);
    return true;
  }

  function save(fields: CardFields): Promise<boolean> {
    if (fields.assignees) setAssignees(fields.assignees);
    if (fields.labels !== undefined) {
      selectedLabelsRef.current = fields.labels;
      setSelectedLabels(fields.labels);
    }
    if (fields.deadline !== undefined) setDeadline(fields.deadline);

    const payload: CardFields = {
      ...fields,
      labels: fields.labels ?? selectedLabelsRef.current,
    };

    const result = saveChainRef.current.then(() => persist(payload));
    saveChainRef.current = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async function handleClose() {
    if (isNew && hasDraftContent()) {
      const created = await save({});
      if (!created && hasDraftContent()) return;
    }
    onClose();
  }
  closeRef.current = () => {
    void handleClose();
  };

  async function handleTitleBlur() {
    const next = title.trim();
    if (!isNew) {
      if (!next) {
        setTitle(currentCard.title);
        return;
      }
      if (next === currentCard.title) return;
      await save({ title: next });
      return;
    }
    if (hasDraftContent({ title: next })) {
      await save({ title: next });
    }
  }

  async function handleDescriptionCommit(
    html: string,
    attachments: RichAttachment[]
  ) {
    setEditingDescription(false);
    setDescription(html);
    setDescriptionAttachments(attachments);
    const prevHtml = currentCard.description || "";
    const prevAttachments = currentCard.descriptionAttachments || [];
    const attachmentsChanged =
      attachments.length !== prevAttachments.length ||
      attachments.some(
        (item, index) =>
          item.url !== prevAttachments[index]?.url ||
          item.path !== prevAttachments[index]?.path
      );
    if (html === prevHtml && !attachmentsChanged) return;
    await save({ description: html, descriptionAttachments: attachments });
  }

  async function handleComment(event: FormEvent) {
    event.preventDefault();
    if (isEmptyHtml(comment) || busy || isNew) return;
    setBusy(true);
    await onComment(comment, commentAttachments);
    if (boardId && currentCard.id) {
      const data = await getCardFeed(boardId, currentCard.id);
      if (data) {
        setFeedComments(data.comments || []);
        setFeedActivity(data.activity || []);
      }
    }
    setComment("");
    setCommentAttachments([]);
    setCommentKey((key) => key + 1);
    setBusy(false);
  }

  const overdue = isDeadlineOverdue(deadline, listId);
  const createdAt =
    currentCard.createdAt ||
    feedActivity.find((item) => item.type === "create")?.createdAt;
  const createdDisplay =
    !isNew && createdAt ? formatTime(createdAt) : "";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={() => {
          void handleClose();
        }}
      />
      <div className="relative w-full max-w-4xl h-[min(46rem,94vh)] max-h-[94vh] overflow-hidden rounded-xl bg-background shadow-xl border border-border flex flex-col">
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
          <div className="flex items-center gap-2">
            {!isNew &&
              (confirmDelete ? (
                <>
                  <span className="text-xs text-gray-400 hidden sm:inline">
                    Delete this card?
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await onDelete();
                      setBusy(false);
                    }}
                    className="px-2 py-1 rounded-md text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 rounded-md text-xs text-gray-300 hover:bg-border-hover"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-border-hover"
                  aria-label="Delete card"
                  title="Delete card"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ))}
            <button
              type="button"
              onClick={() => {
                void handleClose();
              }}
              className="text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_18rem]">
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
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    (event.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Enter a title..."
                className="flex-1 text-xl font-semibold bg-transparent border-0 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 rounded-md px-1 py-0.5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    {selectedLabels.map((id) => (
                      <LabelChip
                        key={id}
                        labelId={id}
                        labels={labels}
                        className="text-xs px-2 py-1"
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setLabelsOpen((prev) => !prev)}
                      className="size-7 rounded-md border border-dashed border-border text-gray-300 hover:text-white flex items-center justify-center"
                      aria-label="Edit labels"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {labelsOpen && (
                    <div className="absolute z-20 mt-2 w-48 rounded-md border border-border bg-background-alt p-2 shadow-xl max-h-48 overflow-y-auto">
                      {labels.map((item) => {
                        const checked = selectedLabels.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-200 hover:bg-border-hover"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const current = selectedLabelsRef.current;
                                const next = current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id];
                                void save({ labels: next });
                              }}
                            />
                            <LabelChip
                              labelId={item.id}
                              labels={labels}
                              className="text-[10px] px-1.5 py-0.5"
                            />
                          </label>
                        );
                      })}
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
                    value={deadline || ""}
                    allowClear
                    onChange={(nextDeadline) => save({ deadline: nextDeadline })}
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

              {createdDisplay && (
                <div>
                  <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-400">
                    Created
                  </p>
                  <p className="text-sm text-gray-200">{createdDisplay}</p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-sm text-gray-400">Description</p>
              {editingDescription ? (
                <RichTextEditor
                  autoFocus
                  value={description}
                  placeholder="Add a more detailed description..."
                  onChange={(html, attachments) => {
                    setDescription(html);
                    setDescriptionAttachments(attachments);
                  }}
                  onBlur={handleDescriptionCommit}
                  uploadImage={
                    boardId && !isNew
                      ? (file) =>
                          uploadCardImage(
                            boardId,
                            currentCard.id,
                            "description",
                            file
                          )
                      : undefined
                  }
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a")) return;
                    setEditingDescription(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setEditingDescription(true);
                    }
                  }}
                  className="w-full text-left min-h-24 px-3 py-2 rounded-md bg-background-alt border border-border text-sm text-gray-200 cursor-text"
                >
                  {isEmptyHtml(description) ? (
                    <span className="text-gray-500">
                      Add a more detailed description...
                    </span>
                  ) : looksLikeHtml(description) ? (
                    <RichTextHtml html={description} />
                  ) : (
                    <DescriptionText text={description} />
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="border-t md:border-t-0 md:border-l border-border p-4 bg-background-alt/40 flex flex-col gap-3 min-h-0 overflow-hidden">
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
              <RichTextEditor
                key={commentKey}
                value={comment}
                disabled={isNew}
                minHeightClass="min-h-20"
                placeholder={
                  isNew ? "Add a title to comment..." : "Write a comment..."
                }
                onChange={(html, attachments) => {
                  setComment(html);
                  setCommentAttachments(attachments);
                }}
                uploadImage={
                  boardId && !isNew
                    ? (file) =>
                        uploadCardImage(
                          boardId,
                          currentCard.id,
                          "comments",
                          file
                        )
                    : undefined
                }
              />
              <button
                type="submit"
                disabled={isNew || busy || isEmptyHtml(comment)}
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
                        <div className="mt-1 text-gray-200">
                          {looksLikeHtml(item.html || "") ? (
                            <RichTextHtml html={item.html || ""} />
                          ) : (
                            <p className="whitespace-pre-wrap">{item.html}</p>
                          )}
                        </div>
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
    </div>,
    document.body
  );
}
