import "dotenv/config";
import admin from "firebase-admin";
import { algoliasearch } from "algoliasearch";
import { db } from "./firebase.js";
import { DEFAULT_LABELS, DEFAULT_LISTS } from "./boardLists.js";

export const FEATURE_BOARD_ID = "feature-requests";

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_WRITE_API_KEY
);
const boardIndexName = "boards";

const FEATURE_BOARD_DATA = {
  name: "Feature Requests",
  urlName: FEATURE_BOARD_ID,
  ownerId: "system",
  privacy: "public",
  kind: "feature-requests",
  background: {
    type: "color",
    value: "linear-gradient(to right, #6366f1, #3b82f6)",
  },
};

export function isFeatureBoard(boardId, data) {
  return (
    boardId === FEATURE_BOARD_ID || data?.kind === "feature-requests"
  );
}

async function indexFeatureBoard(members, createdAt) {
  try {
    await client.saveObjects({
      indexName: boardIndexName,
      objects: [
        {
          objectID: FEATURE_BOARD_ID,
          ...FEATURE_BOARD_DATA,
          members,
          createdAt:
            createdAt instanceof Date
              ? createdAt.toISOString()
              : createdAt?.toDate
                ? createdAt.toDate().toISOString()
                : createdAt,
        },
      ],
    });
  } catch (err) {
    console.error("Error indexing feature board in Algolia:", err);
  }
}

async function updateAlgoliaMembers(members) {
  try {
    await client.partialUpdateObjects({
      indexName: boardIndexName,
      objects: [{ objectID: FEATURE_BOARD_ID, members }],
    });
  } catch (err) {
    console.error("Error updating feature board members in Algolia:", err);
  }
}

export async function ensureFeatureBoardMember(userId) {
  if (!userId) return null;

  const boardRef = db.collection("Boards").doc(FEATURE_BOARD_ID);
  let created = false;
  let joined = false;
  let members = [];
  let createdAt = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(boardRef);
    if (!snap.exists) {
      created = true;
      joined = true;
      members = [userId];
      createdAt = new Date();
      tx.set(boardRef, {
        ...FEATURE_BOARD_DATA,
        createdAt,
        members,
        lists: DEFAULT_LISTS.map((list) => ({ ...list, cards: [] })),
        labels: DEFAULT_LABELS.map((label) => ({ ...label })),
      });
      return;
    }

    const data = snap.data();
    members = data.members || [];
    createdAt = data.createdAt || createdAt;
    if (!members.includes(userId)) {
      joined = true;
      members = [...members, userId];
      tx.update(boardRef, {
        members: admin.firestore.FieldValue.arrayUnion(userId),
      });
    }
  });

  if (created) {
    await indexFeatureBoard(members, createdAt);
  } else if (joined) {
    await updateAlgoliaMembers(members);
  }

  return { id: FEATURE_BOARD_ID, members };
}
