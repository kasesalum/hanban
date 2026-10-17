import { db } from "./firebase.js";
import {
  backfillCompletedAt,
  isArchiveDue,
  markArchived,
} from "./cardArchive.js";
import { activityCol } from "./cardFeed.js";
import { loadCardDocs, writeCardDoc } from "./cardStore.js";

const INTERVAL_MS = 15 * 60 * 1000;

async function latestCompleteTimes(boardId) {
  try {
    const snap = await activityCol(boardId)
      .where("type", "==", "complete")
      .get();
    const map = new Map();
    for (const doc of snap.docs) {
      const data = doc.data();
      const stamp = data.createdAt || "";
      const prev = map.get(data.cardId) || "";
      if (stamp && stamp > prev) map.set(data.cardId, stamp);
    }
    return map;
  } catch (error) {
    console.error("Error loading complete activity:", error);
    return new Map();
  }
}

export async function prepareCardDocs(boardId, { persist = true } = {}) {
  const cards = await loadCardDocs(boardId);
  const completes = persist ? await latestCompleteTimes(boardId) : new Map();
  const now = new Date();
  const next = [];
  const writes = [];

  for (const card of cards) {
    let updated = backfillCompletedAt(card, completes, now);
    if (isArchiveDue(updated, now.getTime())) {
      updated = markArchived(updated, now);
    }
    if (
      persist &&
      (updated.completedAt !== card.completedAt ||
        updated.archived !== card.archived ||
        updated.archivedAt !== card.archivedAt)
    ) {
      writes.push(writeCardDoc(boardId, updated, updated.listId));
    }
    next.push(updated);
  }

  if (writes.length) await Promise.all(writes);
  return next;
}

export async function scanCardArchives() {
  const snap = await db.collection("Boards").get();
  for (const doc of snap.docs) {
    await prepareCardDocs(doc.id, { persist: true });
  }
}

export function startCardArchives() {
  scanCardArchives().catch((error) => {
    console.error("Error scanning card archives:", error);
  });

  setInterval(() => {
    scanCardArchives().catch((error) => {
      console.error("Error scanning card archives:", error);
    });
  }, INTERVAL_MS);
}
