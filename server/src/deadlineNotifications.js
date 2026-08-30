import { db } from "./firebase.js";
import { isMailConfigured, notifyDeadline } from "./mailer.js";

const INTERVAL_MS = 15 * 60 * 1000;

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

export async function scanDeadlineNotifications() {
  const snap = await db.collection("Boards").get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const lists = (data.lists || []).map((list) => ({
      ...list,
      cards: (list.cards || []).map((card) => ({ ...card })),
    }));
    let changed = false;

    for (const list of lists) {
      if (list.id === "done") continue;

      for (const card of list.cards) {
        const kind = deadlineKind(card.deadline);
        if (!kind) continue;
        if (!(card.assignees || []).length) continue;

        const flag =
          kind === "approaching" ? "notifiedApproaching" : "notifiedOverdue";
        if (card[flag]) continue;

        const sent = await notifyDeadline({
          kind,
          boardId: doc.id,
          boardName: data.name || "Untitled board",
          urlName: data.urlName,
          card,
        });

        if (sent || !isMailConfigured()) {
          card[flag] = true;
          changed = true;
        }
      }
    }

    if (changed) {
      await doc.ref.set({ lists }, { merge: true });
    }
  }
}

export function startDeadlineNotifications() {
  scanDeadlineNotifications().catch((error) => {
    console.error("Error scanning deadline notifications:", error);
  });

  setInterval(() => {
    scanDeadlineNotifications().catch((error) => {
      console.error("Error scanning deadline notifications:", error);
    });
  }, INTERVAL_MS);
}
