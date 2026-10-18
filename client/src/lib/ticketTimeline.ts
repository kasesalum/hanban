const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const POSTPONED_RE = /^postponed the due date to (\d{4}-\d{2}-\d{2})$/;
const CHANGED_RE = /^changed the due date to (\d{4}-\d{2}-\d{2})$/;

export const POSTPONE_WARN_DAYS = 14;

export type SlipTone = "neutral" | "amber" | "red";

export type TimelineAction =
  | "created"
  | "postponed"
  | "earlier"
  | "set"
  | "removed"
  | "members";

export type TimelineEvent = {
  id: string;
  at: string;
  action: TimelineAction;
  days: number | null;
  previous: string;
  next: string;
  members: string[];
  added: string[];
  removed: string[];
  legacyText: string;
};

export type TicketTimeline = {
  events: TimelineEvent[];
  originalDeadline: string;
  postponedDays: number;
  postponeCount: number;
};

export type TimelineCard = {
  createdAt?: string;
  deadline?: string;
  originalDeadline?: string;
};

export type TimelineActivity = {
  id?: string;
  type?: string;
  text?: string;
  createdAt?: string;
  previous?: string;
  next?: string;
  deadline?: string;
  assignees?: string[];
  added?: string[];
  removed?: string[];
};

type DeadlineChange = {
  previous: string;
  next: string;
  previousKnown: boolean;
  legacyPostponed: boolean;
};

export function calendarDays(from: string, to: string) {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86400000);
}

export function postponedDayCount(original: string, current: string) {
  const days = calendarDays(original, current);
  if (days == null || days <= 0) return 0;
  return days;
}

export function slipTone(days: number): SlipTone {
  if (days >= POSTPONE_WARN_DAYS) return "red";
  if (days > 0) return "amber";
  return "neutral";
}

function activityTime(createdAt?: string) {
  const time = Date.parse(createdAt || "");
  return Number.isNaN(time) ? 0 : time;
}

function readDeadlineChange(
  entry: TimelineActivity,
  lastKnown = ""
): DeadlineChange | null {
  if (entry.type !== "deadline") return null;

  const structured =
    typeof entry.previous === "string" || typeof entry.next === "string";
  if (structured) {
    return {
      previous: String(entry.previous || ""),
      next: String(entry.next || ""),
      previousKnown: true,
      legacyPostponed: false,
    };
  }

  const text = String(entry.text || "");
  if (text === "removed the due date") {
    return {
      previous: lastKnown,
      next: "",
      previousKnown: Boolean(lastKnown),
      legacyPostponed: false,
    };
  }

  const postponed = text.match(POSTPONED_RE);
  if (postponed) {
    return {
      previous: lastKnown,
      next: postponed[1],
      previousKnown: Boolean(lastKnown),
      legacyPostponed: !lastKnown,
    };
  }

  const changed = text.match(CHANGED_RE);
  if (changed) {
    return {
      previous: lastKnown,
      next: changed[1],
      previousKnown: Boolean(lastKnown),
      legacyPostponed: false,
    };
  }

  return null;
}

function deadlineAction(change: DeadlineChange): TimelineAction {
  if (!change.next) return "removed";
  if (!change.previousKnown) return change.legacyPostponed ? "postponed" : "set";
  if (!change.previous) return "set";
  if (change.next > change.previous) return "postponed";
  if (change.next < change.previous) return "earlier";
  return "set";
}

export function buildTicketTimeline(
  card: TimelineCard,
  activity: TimelineActivity[] = []
): TicketTimeline {
  const entries = [...activity].sort(
    (a, b) => activityTime(a.createdAt) - activityTime(b.createdAt)
  );
  const create = entries.find((entry) => entry.type === "create");
  const current = card.deadline || "";
  const recordedStart = typeof create?.deadline === "string";
  const hasDeadlineEvent = entries.some((entry) => entry.type === "deadline");

  let original = "";
  let lastKnown = "";
  let postponeCount = 0;
  const events: TimelineEvent[] = [];

  let startingDeadline = recordedStart ? create?.deadline || "" : "";
  if (!recordedStart && !hasDeadlineEvent) {
    startingDeadline = card.originalDeadline || current;
  }
  if (startingDeadline) {
    original = startingDeadline;
    lastKnown = startingDeadline;
  }

  if (create || card.createdAt) {
    events.push({
      id: create?.id || "create",
      at: create?.createdAt || card.createdAt || "",
      action: "created",
      days: null,
      previous: "",
      next: startingDeadline,
      members: Array.isArray(create?.assignees) ? [...create.assignees] : [],
      added: [],
      removed: [],
      legacyText: "",
    });
  }

  entries.forEach((entry, index) => {
    if (entry.type === "deadline") {
      const change = readDeadlineChange(entry, lastKnown);
      if (!change) return;
      if (!original) {
        if (change.previous) original = change.previous;
        else if (change.next) original = change.next;
      }
      const days =
        change.previousKnown && change.previous && change.next
          ? calendarDays(change.previous, change.next)
          : null;
      if (days != null && days > 0) postponeCount += 1;
      events.push({
        id: entry.id || `deadline-${index}`,
        at: entry.createdAt || "",
        action: deadlineAction(change),
        days,
        previous: change.previousKnown ? change.previous : "",
        next: change.next,
        members: [],
        added: [],
        removed: [],
        legacyText: "",
      });
      lastKnown = change.next || "";
      return;
    }

    if (entry.type !== "assignees") return;
    const structured =
      Array.isArray(entry.added) || Array.isArray(entry.removed);
    events.push({
      id: entry.id || `members-${index}`,
      at: entry.createdAt || "",
      action: "members",
      days: null,
      previous: "",
      next: "",
      members: [],
      added: structured ? [...(entry.added || [])] : [],
      removed: structured ? [...(entry.removed || [])] : [],
      legacyText: structured ? "" : String(entry.text || ""),
    });
  });

  if (!original && current) original = current;
  if (card.originalDeadline) original = card.originalDeadline;

  events.sort((a, b) => activityTime(a.at) - activityTime(b.at));

  return {
    events,
    originalDeadline: original,
    postponedDays: postponedDayCount(original, current),
    postponeCount,
  };
}
