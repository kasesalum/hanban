export const DONE_WINDOW_DAYS = 30;
export const ARCHIVE_AFTER_MS = DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function completionTime(card) {
  return card?.completedAt || card?.createdAt || "";
}

export function isArchiveDue(card, now = Date.now()) {
  if (!card || card.archived || card.cancelled) return false;
  if ((card.listId || "") !== "done") return false;
  const stamp = Date.parse(completionTime(card));
  if (Number.isNaN(stamp)) return true;
  return now - stamp >= ARCHIVE_AFTER_MS;
}

export function shouldShowInDone(card, now = Date.now()) {
  if (!card || card.archived) return false;
  const stamp = Date.parse(completionTime(card));
  if (Number.isNaN(stamp)) return true;
  return now - stamp < ARCHIVE_AFTER_MS;
}

export function isVisibleOnBoard(card, listId, now = Date.now()) {
  if (!card || card.archived || card.cancelled) return false;
  if (listId === "done") return shouldShowInDone(card, now);
  return true;
}

export function cancelCard(card, now = new Date()) {
  return {
    ...card,
    cancelled: true,
    cancelledAt: now.toISOString(),
  };
}

export function clearCancelled(card) {
  const next = { ...card };
  delete next.cancelled;
  delete next.cancelledAt;
  return next;
}

export function restoreCard(card, now = new Date()) {
  const next = clearCancelled(card);
  const at = now instanceof Date ? now : new Date(now);
  if ((next.listId || "") === "done" && isArchiveDue(next, at.getTime())) {
    next.completedAt = at.toISOString();
  }
  return next;
}

export function applyDoneTransition(card, fromListId, toListId) {
  const next = { ...card, listId: toListId || card.listId };
  if (toListId === "done" && fromListId !== "done") {
    next.completedAt = new Date().toISOString();
    delete next.archived;
    delete next.archivedAt;
  }
  if (fromListId === "done" && toListId && toListId !== "done") {
    delete next.completedAt;
    delete next.archived;
    delete next.archivedAt;
  }
  return next;
}

export function markArchived(card, now = new Date()) {
  return {
    ...card,
    archived: true,
    archivedAt: now.toISOString(),
  };
}

export function backfillCompletedAt(card, completeTimes = new Map(), now = new Date()) {
  if (card?.cancelled) return card;
  if ((card.listId || "") !== "done" || card.completedAt) return card;
  return {
    ...card,
    completedAt:
      completeTimes.get(card.id) || card.createdAt || now.toISOString(),
  };
}
