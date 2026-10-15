import { db } from "../firebase.js";
import { listsPayload } from "../boardLists.js";
import { cardsCol, toStoredCard } from "../cardStore.js";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const boardsSnap = await db.collection("Boards").get();
  let copied = 0;
  let skipped = 0;
  let missingId = 0;
  let duplicates = 0;

  for (const doc of boardsSnap.docs) {
    const data = doc.data();
    const lists = data.lists || [];
    const seen = new Set();
    const nextLists = [];
    const writes = [];
    const col = await cardsCol(doc.id);

    for (const list of lists) {
      const cards = list.cards || [];
      const cardIds = [];
      for (const card of cards) {
        if (!card?.id) {
          missingId += 1;
          console.warn(`Skipping card without id on board ${doc.id} list ${list.id}`);
          continue;
        }
        if (seen.has(card.id)) {
          duplicates += 1;
          console.warn(`Duplicate card id ${card.id} on board ${doc.id}`);
          continue;
        }
        seen.add(card.id);
        cardIds.push(card.id);
        writes.push({
          ref: col.doc(card.id),
          data: toStoredCard(card, list.id),
        });
      }
      nextLists.push({
        ...list,
        cardIds: Array.isArray(list.cardIds) && list.cardIds.length
          ? list.cardIds
          : cardIds,
      });
    }

    copied += writes.length;
    if (!writes.length && lists.every((list) => Array.isArray(list.cardIds))) {
      skipped += 1;
    }

    if (dryRun) continue;

    const batchSize = 400;
    for (let i = 0; i < writes.length; i += batchSize) {
      const batch = db.batch();
      for (const write of writes.slice(i, i + batchSize)) {
        batch.set(write.ref, write.data);
      }
      await batch.commit();
    }
    await doc.ref.set(
      { lists: listsPayload(nextLists, { nested: true }) },
      { merge: true }
    );
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        boards: boardsSnap.size,
        copied,
        boardsAlreadyMigrated: skipped,
        missingId,
        duplicates,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Card copy failed:", error);
  process.exit(1);
});
