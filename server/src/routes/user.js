import "dotenv/config";
import express from "express";
import { db } from "../firebase.js";
import admin from "firebase-admin";
import { algoliasearch } from "algoliasearch";
import { DEFAULT_LABELS, DEFAULT_LISTS } from "../boardLists.js";
import { ensureFeatureBoardMember } from "../featureBoard.js";
import { searchUsers } from "../users.js";

const router = express.Router();

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_WRITE_API_KEY
);
const boardIndexName = "boards";

// GET /api/user/search?q=
router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ users: [] });
    }
    const users = await searchUsers(q);
    res.json({ users });
  } catch (err) {
    console.error("Error searching users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/user/boards?userId=123
router.get("/boards", async (req, res) => {
  console.log("Received request for user boards with query:", req.query);
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const userRef = db.collection("Users").doc(userId);
    const userSnap = await userRef.get();
    const pinned = userSnap.exists ? userSnap.data().PinnedBoards || [] : [];

    await ensureFeatureBoardMember(userId);

    const boardsSnap = await db
      .collection("Boards")
      .where("members", "array-contains", userId)
      .get();

    const boards = boardsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        objectID: doc.id,
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
      };
    });

    res.json({
      boards,
      pinned,
    });
  } catch (err) {
    console.error("Error fetching boards:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/user/pinBoard?userId=123&boardId=456
router.get("/pinBoard", async (req, res) => {
  console.log("Received request for pinBoard with query:", req.query);
  try {
    const { userId, boardId } = req.query;

    const userRef = db.collection("Users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const pinnedBoards = userSnap.data().PinnedBoards || [];
    const isPinned = pinnedBoards.includes(boardId);

    if (!isPinned) {
      await userRef.update({
        PinnedBoards: admin.firestore.FieldValue.arrayUnion(boardId),
      });
      res.json({ message: "Board pinned", pinned: true });
    } else {
      await userRef.update({
        PinnedBoards: admin.firestore.FieldValue.arrayRemove(boardId),
      });
      res.json({ message: "Board unpinned", pinned: false });
    }
  } catch (err) {
    console.error("Error pinning board:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/user/createBoard
router.post("/createBoard", async (req, res) => {
  console.log("Received request for createBoard with body:", req.body);
  try {
    const { userId, title, privacy, background } = req.body;
    if (!userId || !title || !privacy || typeof background === "undefined") {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalisedName = title.trim().substring(0, 50);
    const urlName = normalisedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);

    const newBoardData = {
      name: normalisedName,
      urlName: urlName,
      createdAt: new Date(),
      ownerId: userId,
      privacy: privacy,
      members: [userId],
      background: background,
      lists: DEFAULT_LISTS.map((list) => ({ ...list, cards: [] })),
      labels: DEFAULT_LABELS.map((label) => ({ ...label })),
    };

    const newBoardDoc = await db.collection("Boards").add(newBoardData);

    const userRef = db.collection("Users").doc(userId);
    await userRef.set(
      {
        Boards: admin.firestore.FieldValue.arrayUnion(newBoardDoc.id),
      },
      { merge: true }
    );

    try {
      await client.saveObjects({
        indexName: boardIndexName,
        objects: [
          {
            objectID: newBoardDoc.id,
            ...newBoardData,
            createdAt: newBoardData.createdAt.toISOString(),
          },
        ],
      });
    } catch (algoliaErr) {
      console.error("Error indexing board in Algolia:", algoliaErr);
    }

    res.json({ boardId: newBoardDoc.id });
  } catch (err) {
    console.error("Error creating board:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
