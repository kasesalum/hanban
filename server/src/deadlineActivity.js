const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const POSTPONED_RE = /^postponed the due date to (\d{4}-\d{2}-\d{2})$/;
const CHANGED_RE = /^changed the due date to (\d{4}-\d{2}-\d{2})$/;

export function deadlineActivityText(previous, next) {
  const prev = String(previous || "");
  const value = String(next || "");
  if (!value) return "removed the due date";
  if (prev && value > prev) return `postponed the due date to ${value}`;
  return `changed the due date to ${value}`;
}

export function calendarDays(from, to) {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86400000);
}

export function postponedDayCount(original, current) {
  const days = calendarDays(original, current);
  if (days == null || days <= 0) return 0;
  return days;
}

export function readDeadlineChange(entry, lastKnown = "") {
  if (!entry || entry.type !== "deadline") return null;

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

function activityTime(entry) {
  const time = Date.parse(entry?.createdAt || "");
  return Number.isNaN(time) ? 0 : time;
}

export function slipSummary(card, activity = []) {
  const current = String(card?.deadline || "");
  const storedOriginal = String(card?.originalDeadline || "");
  const entries = [...(activity || [])].sort(
    (a, b) => activityTime(a) - activityTime(b)
  );

  let original = "";
  let lastKnown = "";
  let postponeCount = 0;

  const create = entries.find((entry) => entry?.type === "create");
  if (create && typeof create.deadline === "string" && create.deadline) {
    original = create.deadline;
    lastKnown = create.deadline;
  }

  for (const entry of entries) {
    if (entry?.type !== "deadline") continue;
    const change = readDeadlineChange(entry, lastKnown);
    if (!change) continue;
    if (!original) {
      if (change.previous) original = change.previous;
      else if (change.next) original = change.next;
    }
    if (
      change.previousKnown &&
      change.previous &&
      change.next &&
      change.next > change.previous
    ) {
      postponeCount += 1;
    }
    lastKnown = change.next || "";
  }

  if (!original && current) original = current;
  if (storedOriginal) original = storedOriginal;

  return {
    originalDeadline: original,
    postponeCount,
    postponedDays: postponedDayCount(original, current),
  };
}

export function needsSlipBackfill(card) {
  return (
    typeof card?.postponedDays !== "number" ||
    typeof card?.postponeCount !== "number"
  );
}
