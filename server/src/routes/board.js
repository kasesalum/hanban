import "dotenv/config";
import express from "express";
import { randomUUID } from "crypto";
import admin from "firebase-admin";
import { algoliasearch } from "algoliasearch";
import { db } from "../firebase.js";
import {
  HEX_COLOR,
  withDefaultLabels,
  withDefaultLists,
} from "../boardLists.js";

const router = express.Router();
const algolia = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_WRITE_API_KEY
);
const boardIndexName = "boards";

async function updateAlgoliaMembers(boardId, members) {
  try {
    await algolia.partialUpdateObjects({
      indexName: boardIndexName,
      objects: [{ objectID: boardId, members }],
    });
  } catch (err) {
    console.error("Error updating Algolia members:", err);
  }
}

function cloneLists(data) {
  return withDefaultLists(data).map((list) => ({
    ...list,
    cards: [...(list.cards || [])],
  }));
}

// POST /api/board/:id/cards
router.post("/:id/cards", async (req, res) => {
  try {
    const boardId = req.params.id;
    const { listId, title, description, assignees, label, deadline } = req.body;

    if (!listId || !title || !String(title).trim()) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();

    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const boardData = boardSnap.data();
    const members = boardData.members || [];
    const labels = withDefaultLabels(boardData);
    const lists = cloneLists(boardData);

    const list = lists.find((item) => item.id === listId);
    if (!list) {
      return res.status(400).json({ error: "List not found" });
    }

    const assigneeIds = Array.isArray(assignees) ? assignees : [];
    if (assigneeIds.some((uid) => !members.includes(uid))) {
      return res.status(400).json({ error: "Invalid assignee" });
    }

    if (label && !labels.some((item) => item.id === label)) {
      return res.status(400).json({ error: "Invalid label" });
    }

    const card = {
      id: randomUUID(),
      title: String(title).trim().substring(0, 120),
      description: description ? String(description).trim() : "",
      assignees: assigneeIds,
      label: label || "",
      deadline: deadline ? String(deadline) : "",
    };

    list.cards.push(card);
    await boardRef.set({ lists }, { merge: true });

    res.json({ card, lists });
  } catch (error) {
    console.error("Error creating card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/board/:id/cards/:cardId
router.patch("/:id/cards/:cardId", async (req, res) => {
  try {
    const { id: boardId, cardId } = req.params;
    const { listId } = req.body;

    if (!listId) {
      return res.status(400).json({ error: "Missing listId" });
    }

    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();

    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const lists = cloneLists(boardSnap.data());
    const target = lists.find((item) => item.id === listId);
    if (!target) {
      return res.status(400).json({ error: "List not found" });
    }

    let card = null;
    for (const list of lists) {
      const index = list.cards.findIndex((item) => item.id === cardId);
      if (index !== -1) {
        [card] = list.cards.splice(index, 1);
        break;
      }
    }

    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }

    target.cards.push(card);
    await boardRef.set({ lists }, { merge: true });

    res.json({ card, lists });
  } catch (error) {
    console.error("Error moving card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/board/:id/labels
router.put("/:id/labels", async (req, res) => {
  try {
    const boardId = req.params.id;
    const incoming = req.body.labels;

    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: "Missing labels" });
    }

    const labels = incoming.map((label) => {
      const name = String(label.name || "").trim();
      const color = String(label.color || "").trim();
      if (!name || !HEX_COLOR.test(color)) {
        throw new Error("invalid-label");
      }
      return {
        id: label.id ? String(label.id) : randomUUID(),
        name: name.substring(0, 40),
        color,
      };
    });

    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const allowed = new Set(labels.map((label) => label.id));
    const lists = cloneLists(boardSnap.data()).map((list) => ({
      ...list,
      cards: list.cards.map((card) =>
        card.label && !allowed.has(card.label)
          ? { ...card, label: "" }
          : card
      ),
    }));

    await boardRef.set({ labels, lists }, { merge: true });
    res.json({ labels, lists });
  } catch (error) {
    if (error.message === "invalid-label") {
      return res.status(400).json({ error: "Invalid label name or color" });
    }
    console.error("Error updating labels:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/board/:id/members
router.post("/:id/members", async (req, res) => {
  try {
    const boardId = req.params.id;
    const email = String(req.body.email || "").trim();
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch {
      return res.status(404).json({ error: "User not found" });
    }

    await boardRef.update({
      members: admin.firestore.FieldValue.arrayUnion(userRecord.uid),
    });

    const nextSnap = await boardRef.get();
    const members = nextSnap.data().members || [];
    await updateAlgoliaMembers(boardId, members);

    res.json({ members });
  } catch (error) {
    console.error("Error adding member:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/board/:id/members
router.delete("/:id/members", async (req, res) => {
  try {
    const boardId = req.params.id;
    const { email, uid } = req.body || {};

    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const data = boardSnap.data();
    let memberUid = uid ? String(uid) : "";

    if (!memberUid && email) {
      try {
        const userRecord = await admin.auth().getUserByEmail(String(email).trim());
        memberUid = userRecord.uid;
      } catch {
        return res.status(404).json({ error: "User not found" });
      }
    }

    if (!memberUid) {
      return res.status(400).json({ error: "Missing email or uid" });
    }

    if (memberUid === data.ownerId) {
      return res.status(400).json({ error: "Cannot remove the board owner" });
    }

    const lists = cloneLists(data).map((list) => ({
      ...list,
      cards: list.cards.map((card) => ({
        ...card,
        assignees: (card.assignees || []).filter((id) => id !== memberUid),
      })),
    }));

    await boardRef.update({
      members: admin.firestore.FieldValue.arrayRemove(memberUid),
      lists,
    });

    const nextSnap = await boardRef.get();
    const members = nextSnap.data().members || [];
    await updateAlgoliaMembers(boardId, members);

    res.json({ members, lists });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/board/:id
router.get("/:id", async (req, res) => {
  try {
    const boardId = req.params.id;
    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();

    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const data = boardSnap.data();
    const lists = withDefaultLists(data);
    const labels = withDefaultLabels(data);
    const updates = {};

    const existingListIds = (data.lists || []).map((list) => list.id).join(",");
    const nextListIds = lists.map((list) => list.id).join(",");
    if (existingListIds !== nextListIds) updates.lists = lists;

    if (!Array.isArray(data.labels) || data.labels.length === 0) {
      updates.labels = labels;
    }

    if (Object.keys(updates).length > 0) {
      await boardRef.set(updates, { merge: true });
    }

    res.json({ id: boardSnap.id, ...data, lists, labels });
  } catch (error) {
    console.error("Error fetching board:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
