import "dotenv/config";
import { algoliasearch } from "algoliasearch";
import { db } from "../firebase.js";
import { algoliaBoardRecord } from "../boardLists.js";

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_WRITE_API_KEY
);

const boardIndexName = "boards";

const backfillBoards = async () => {
  try {
    const boardsSnap = await db.collection("Boards").get();
    const boards = boardsSnap.docs.map((doc) =>
      algoliaBoardRecord(doc.id, {
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate
          ? doc.data().createdAt.toDate().toISOString()
          : doc.data().createdAt,
      })
    );

    await client.saveObjects({ indexName: boardIndexName, objects: boards });
    console.log(`Successfully indexed ${boards.length} boards`);
  } catch (err) {
    console.error("Error backfilling boards:", err);
  }
};

backfillBoards();
