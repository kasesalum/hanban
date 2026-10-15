import { db } from "../firebase.js";
import { cardsCol } from "../cardStore.js";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const boardsSnap = await db.collection("Boards").get();
  const skipped = [];
  let stripped = 0;

  for (const doc of boardsSnap.docs) {
    const data = doc.data();
    const lists = data.lists || [];
    const cardSnap = await (await cardsCol(doc.id)).get();
    const cardIds = lists.reduce(
      (sum, list) => sum + ((list.cardIds || []).length || 0),
      0
    );

    if (cardIds !== cardSnap.size) {
      skipped.push({
        boardId: doc.id,
        cardIds,
        cardDocs: cardSnap.size,
      });
      continue;
    }

    const nextLists = lists.map((list) => ({
      id: list.id,
      title: list.title,
      cardIds: Array.isArray(list.cardIds) ? list.cardIds : [],
    }));

    stripped += 1;
    if (dryRun) continue;
    await doc.ref.set({ lists: nextLists }, { merge: true });
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        stripped,
        skipped,
      },
      null,
      2
    )
  );
  if (skipped.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Strip failed:", error);
  process.exit(1);
});
