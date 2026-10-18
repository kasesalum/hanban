"use client";

import { assigneeLabel, type MemberProfile } from "@/components/boards/boardCard";
import {
  buildTicketTimeline,
  postponedDayCount,
  slipTone,
  type TimelineCard,
  type TimelineEvent,
  type TimelineActivity,
} from "@/lib/ticketTimeline";
import { ChevronDown, History } from "lucide-react";
import { useId, useState } from "react";

function formatWhen(value: string) {
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

function formatDue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  );
}

function names(
  ids: string[],
  currentUserId?: string,
  profiles?: MemberProfile[]
) {
  return ids
    .map((uid) => assigneeLabel(uid, currentUserId, profiles))
    .filter(Boolean)
    .join(", ");
}

function eventTitle(event: TimelineEvent) {
  if (event.action === "created") return "Created";
  if (event.action === "postponed") {
    if (event.days == null) return "Postponed";
    return event.days === 1 ? "+1 day" : `+${event.days} days`;
  }
  if (event.action === "earlier") return "Moved earlier";
  if (event.action === "removed") return "Removed the due date";
  if (event.action === "set") return "Set the due date";
  return "";
}

function eventDetail(
  event: TimelineEvent,
  currentUserId?: string,
  profiles?: MemberProfile[]
) {
  if (event.action === "members") {
    if (event.legacyText) return event.legacyText;
    const added = names(event.added, currentUserId, profiles);
    const removed = names(event.removed, currentUserId, profiles);
    if (added && removed) return `Added ${added} and removed ${removed}`;
    if (added) return `Added ${added}`;
    if (removed) return `Removed ${removed}`;
    return "Changed members";
  }

  if (event.action === "created") {
    const bits: string[] = [];
    if (event.next) bits.push(`Due ${formatDue(event.next)}`);
    const members = names(event.members, currentUserId, profiles);
    if (members) bits.push(members);
    return bits.join(" · ");
  }

  if (event.action === "removed") {
    return event.previous ? formatDue(event.previous) : "";
  }

  if (event.previous && event.next) {
    return `${formatDue(event.previous)} → ${formatDue(event.next)}`;
  }
  if (event.next) return `to ${formatDue(event.next)}`;
  return "";
}

function dotClass(event: TimelineEvent, originalDeadline: string) {
  if (event.action !== "postponed") {
    return "border-gray-500 bg-background";
  }
  if (event.days == null) return "border-amber-400 bg-amber-400";
  const total = postponedDayCount(originalDeadline, event.next);
  if (slipTone(total) === "red") return "border-red-500 bg-red-500";
  return "border-amber-400 bg-amber-400";
}

export default function TicketTimeline({
  card,
  activity,
  currentUserId,
  memberProfiles,
}: {
  card: TimelineCard;
  activity: TimelineActivity[];
  currentUserId?: string;
  memberProfiles?: MemberProfile[];
}) {
  const timeline = buildTicketTimeline(card, activity);
  const [open, setOpen] = useState(true);
  const listId = useId();
  if (timeline.events.length === 0) return null;

  const tone = slipTone(timeline.postponedDays);
  const summaryColor =
    tone === "red"
      ? "text-red-400"
      : tone === "amber"
        ? "text-amber-200"
        : "text-gray-400";
  const summary =
    timeline.postponedDays > 0
      ? `Postponed ${timeline.postponedDays} ${
          timeline.postponedDays === 1 ? "day" : "days"
        }`
      : "";

  return (
    <section>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((prev) => !prev)}
          className="mb-2 flex w-full items-center gap-2 text-left text-sm text-gray-400 hover:text-white"
        >
          <History className="w-4 h-4 shrink-0" />
          <span>Timeline</span>
          {summary && (
            <span className={`font-medium ${summaryColor}`}>{summary}</span>
          )}
          <ChevronDown
            className={`ml-auto w-4 h-4 shrink-0 transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        </button>
      </h3>
      {open && (
        <ol id={listId}>
        {timeline.events.map((event, index) => {
          const detail = eventDetail(event, currentUserId, memberProfiles);
          const title =
            event.action === "members"
              ? detail
              : eventTitle(event);
          const last = index === timeline.events.length - 1;
          return (
            <li key={event.id} className="relative pl-6 pb-4 last:pb-0">
              {!last && (
                <span className="absolute left-[6px] top-3 bottom-0 w-px bg-border" />
              )}
              <span
                className={`absolute left-0 top-1 size-3.5 rounded-full border-2 ${dotClass(
                  event,
                  timeline.originalDeadline
                )}`}
              />
              <p className="text-sm text-white">{title}</p>
              {event.action !== "members" && detail && (
                <p className="text-xs text-gray-400">{detail}</p>
              )}
              {event.at && (
                <p className="mt-0.5 text-xs text-blue-400">
                  {formatWhen(event.at)}
                </p>
              )}
            </li>
          );
        })}
        </ol>
      )}
    </section>
  );
}
