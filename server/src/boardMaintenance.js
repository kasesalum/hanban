import { db } from "./firebase.js";
import { prepareCardDocs } from "./cardArchives.js";
import { assembleLists } from "./cardStore.js";
import { notifyAssembledBoard } from "./deadlineNotifications.js";

const INTERVAL_MS = 60 * 60 * 1000;
const QUOTA_BACKOFF_MS = 12 * 60 * 60 * 1000;

function isQuotaError(error) {
  const code = error?.code;
  return (
    code === 8 ||
    code === "8" ||
    code === "resource-exhausted" ||
    /quota exceeded/i.test(String(error?.message || ""))
  );
}

export async function maintainBoards() {
  const snap = await db.collection("Boards").get();
  for (const doc of snap.docs) {
    try {
      const data = doc.data();
      const cards = await prepareCardDocs(doc.id, { persist: true });
      const lists = assembleLists(data, cards);
      await notifyAssembledBoard(doc.ref, doc.id, data, lists);
    } catch (error) {
      console.error(`Error maintaining board ${doc.id}:`, error);
      if (isQuotaError(error)) throw error;
    }
  }
}

export function startBoardMaintenance() {
  let running = false;
  let pausedUntil = 0;

  const run = () => {
    if (running || Date.now() < pausedUntil) return;
    running = true;
    maintainBoards()
      .catch((error) => {
        console.error("Error maintaining boards:", error);
        if (isQuotaError(error)) {
          pausedUntil = Date.now() + QUOTA_BACKOFF_MS;
          console.error(
            "Firestore quota exceeded; pausing board maintenance for 12 hours"
          );
        }
      })
      .finally(() => {
        running = false;
      });
  };

  // Hourly on purpose. Separate 15-minute passes used to reread every card
  // and every completion event, which used up Firestore's free daily reads.
  // After that quota is gone, loading a board fails until the next reset.
  run();
  setInterval(run, INTERVAL_MS);
}
