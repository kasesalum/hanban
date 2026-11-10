import { pausesNotifications } from "./boardLists.js";
import { notifyUsers } from "./mailer.js";
import { NOTIFICATION_TYPES } from "./notifications.js";
import { saveBoardLists, writeCardDoc } from "./cardStore.js";

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayISO() {
  return toISODate(new Date());
}

function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toISODate(date);
}

function deadlineKind(deadline) {
  if (!deadline) return null;
  const today = todayISO();
  const tomorrow = tomorrowISO();
  if (deadline < today) return "overdue";
  if (deadline === today || deadline === tomorrow) return "approaching";
  return null;
}

export async function notifyAssembledBoard(boardRef, boardId, data, lists) {
  let changed = false;

  for (const list of lists) {
    if (pausesNotifications(list.id)) continue;

    for (const card of list.cards || []) {
      const kind = deadlineKind(card.deadline);
      if (!kind) continue;
      if (!(card.assignees || []).length) continue;

      const flag =
        kind === "approaching" ? "notifiedApproaching" : "notifiedOverdue";
      if (card[flag]) continue;

      await notifyUsers({
        type:
          kind === "approaching"
            ? NOTIFICATION_TYPES.deadlineApproaching
            : NOTIFICATION_TYPES.deadlineOverdue,
        userIds: card.assignees || [],
        boardId,
        boardName: data.name || "Untitled board",
        urlName: data.urlName,
        card,
      });

      card[flag] = true;
      await writeCardDoc(boardId, card, list.id);
      changed = true;
    }
  }

  if (changed) {
    await saveBoardLists(boardRef, lists, data);
  }
}
