export const DONE_WINDOW_DAYS = 30;
export const ARCHIVE_AFTER_MS = DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type SortKey =
  | "deadline-asc"
  | "deadline-desc"
  | "title-asc"
  | "title-desc"
  | "created-desc"
  | "created-asc"
  | "completed-desc"
  | "completed-asc";

export type SortableCard = {
  id: string;
  title: string;
  deadline?: string;
  createdAt?: string;
  completedAt?: string;
  archived?: boolean;
};

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "deadline-asc", label: "Due date (soonest)" },
  { value: "deadline-desc", label: "Due date (latest)" },
  { value: "title-asc", label: "Title (A-Z)" },
  { value: "title-desc", label: "Title (Z-A)" },
  { value: "created-desc", label: "Created (newest)" },
  { value: "created-asc", label: "Created (oldest)" },
  { value: "completed-desc", label: "Completed (newest)" },
  { value: "completed-asc", label: "Completed (oldest)" },
];

export function defaultSortForList(listId: string): SortKey {
  return listId === "done" ? "completed-desc" : "deadline-asc";
}

function completionStamp(card: SortableCard) {
  return card.completedAt || card.createdAt || "";
}

function compareMissing(a: string, b: string, titleA: string, titleB: string) {
  if (!a && !b) return titleA.localeCompare(titleB);
  if (!a) return 1;
  if (!b) return -1;
  return 0;
}

export function sortCards<T extends SortableCard>(cards: T[], key: SortKey): T[] {
  const copy = [...cards];
  copy.sort((a, b) => {
    const titleA = a.title || "";
    const titleB = b.title || "";
    if (key === "deadline-asc" || key === "deadline-desc") {
      const aD = a.deadline || "";
      const bD = b.deadline || "";
      const missing = compareMissing(aD, bD, titleA, titleB);
      if (missing) return missing;
      const cmp = aD.localeCompare(bD);
      return key === "deadline-asc" ? cmp : -cmp;
    }
    if (key === "title-asc" || key === "title-desc") {
      const cmp = titleA.localeCompare(titleB, undefined, { sensitivity: "base" });
      return key === "title-asc" ? cmp : -cmp;
    }
    if (key === "completed-asc" || key === "completed-desc") {
      const aC = completionStamp(a);
      const bC = completionStamp(b);
      const missing = compareMissing(aC, bC, titleA, titleB);
      if (missing) return missing;
      const cmp = aC.localeCompare(bC);
      return key === "completed-asc" ? cmp : -cmp;
    }
    const aC = a.createdAt || "";
    const bC = b.createdAt || "";
    const missing = compareMissing(aC, bC, titleA, titleB);
    if (missing) return missing;
    const cmp = aC.localeCompare(bC);
    return key === "created-asc" ? cmp : -cmp;
  });
  return copy;
}

export function isDoneVisible(card: SortableCard, now = Date.now()) {
  if (card.archived) return false;
  const stamp = Date.parse(completionStamp(card));
  if (Number.isNaN(stamp)) return true;
  return now - stamp < ARCHIVE_AFTER_MS;
}

function monthKey(stamp: string) {
  const parsed = Date.parse(stamp);
  const date = Number.isNaN(parsed) ? new Date(0) : new Date(parsed);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthCompletedKey(card: SortableCard) {
  return monthKey(completionStamp(card));
}

export function monthCompletedLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, 1));
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function groupCardsByMonth<T>(
  cards: T[],
  stampFor: (card: T) => string
): { key: string; label: string; cards: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const card of cards) {
    const key = monthKey(stampFor(card));
    const list = groups.get(key) || [];
    list.push(card);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, grouped]) => ({
      key,
      label: monthCompletedLabel(key),
      cards: grouped,
    }));
}

export function groupCardsByCompletedMonth<T extends SortableCard>(
  cards: T[]
): { key: string; label: string; cards: T[] }[] {
  return groupCardsByMonth(cards, completionStamp);
}

export function groupCardsByCancelledMonth<T extends { cancelledAt?: string }>(
  cards: T[]
): { key: string; label: string; cards: T[] }[] {
  return groupCardsByMonth(cards, (card) => card.cancelledAt || "");
}
