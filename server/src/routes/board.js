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
import { notifyUsers } from "../mailer.js";
import { NOTIFICATION_TYPES } from "../notifications.js";
import { memberProfilesForUids } from "../users.js";
import {
  FEATURE_BOARD_ID,
  ensureFeatureBoardMember,
  isFeatureBoard,
} from "../featureBoard.js";
import {
  addActivity,
  addComment,
  deleteCardFeed,
  listFeed,
  migrateNestedCard,
  normalizeAttachments,
  stripCardFeed,
  stripListsFeed,
} from "../cardFeed.js";
import {
  decodeImagePayload,
  extForContentType,
  uploadImageBuffer,
} from "../storageUpload.js";
import {
  htmlToPlain,
  isEmptyHtml,
  sanitizeHtml,
} from "../htmlSanitize.js";

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

function findCard(lists, cardId) {
  for (const list of lists) {
    const index = list.cards.findIndex((item) => item.id === cardId);
    if (index !== -1) {
      return { list, index, card: list.cards[index] };
    }
  }
  return null;
}

// POST /api/board/:id/cards
router.post("/:id/cards", async (req, res) => {
  try {
    const boardId = req.params.id;
    const { listId, title, description, assignees, label, deadline, actorId } =
      req.body || {};
    const actor = String(actorId || "");

    if (!listId) {
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
      title: String(title || "").trim().substring(0, 120) || "Untitled",
      description: description ? sanitizeHtml(String(description)) : "",
      assignees: assigneeIds,
      label: label || "",
      deadline: deadline ? String(deadline) : "",
      createdAt: new Date().toISOString(),
      createdBy: actor,
    };

    list.cards.push(card);
    await boardRef.set({ lists }, { merge: true });
    await addActivity(boardId, card.id, {
      userId: actor,
      type: "create",
      text: "created this card",
    });

    if (assigneeIds.length > 0 && listId !== "done") {
      notifyUsers({
        type: NOTIFICATION_TYPES.assigneeAdded,
        userIds: assigneeIds,
        actorId: actor,
        boardId,
        boardName: boardData.name || "Untitled board",
        urlName: boardData.urlName,
        card,
      }).catch((err) => {
        console.error("Error sending assignee notification:", err);
      });
    }

    res.json({ card, lists: stripListsFeed(lists) });
  } catch (error) {
    console.error("Error creating card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/board/:id/cards/:cardId
router.patch("/:id/cards/:cardId", async (req, res) => {
  try {
    const { id: boardId, cardId } = req.params;
    const {
      listId,
      title,
      description,
      assignees,
      label,
      deadline,
      actorId,
      descriptionAttachments,
    } = req.body || {};
    const actor = String(actorId || "");

    const hasList = typeof listId === "string" && listId.length > 0;
    const hasTitle = typeof title === "string";
    const hasDescription = typeof description === "string";
    const hasAssignees = Array.isArray(assignees);
    const hasLabel = typeof label === "string";
    const hasDeadline = typeof deadline === "string";

    if (
      !hasList &&
      !hasTitle &&
      !hasDescription &&
      !hasAssignees &&
      !hasLabel &&
      !hasDeadline
    ) {
      return res.status(400).json({ error: "Missing fields" });
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
    const found = findCard(lists, cardId);
    if (!found) {
      return res.status(404).json({ error: "Card not found" });
    }

    let card = { ...found.card };
    await migrateNestedCard(boardId, card);
    const pendingActivity = [];

    if (hasTitle) {
      const next = String(title).trim().substring(0, 120);
      if (!next) {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      if (next !== card.title) {
        pendingActivity.push({
          userId: actor,
          type: "title",
          text: `renamed this card to “${next}”`,
        });
        card.title = next;
      }
    }

    if (hasDescription) {
      const next = sanitizeHtml(String(description));
      if (next !== (card.description || "")) {
        pendingActivity.push({
          userId: actor,
          type: "description",
          text: isEmptyHtml(next)
            ? "removed the description"
            : "updated the description",
        });
        card.description = next;
      }
      if (Array.isArray(descriptionAttachments)) {
        card.descriptionAttachments = normalizeAttachments(
          descriptionAttachments
        );
      }
    }

    const previousListId = found.list.id;
    let addedAssignees = [];
    let deadlineChanged = false;
    if (hasAssignees) {
      const assigneeIds = assignees.map((uid) => String(uid));
      if (assigneeIds.some((uid) => !members.includes(uid))) {
        return res.status(400).json({ error: "Invalid assignee" });
      }
      const prev = card.assignees || [];
      addedAssignees = assigneeIds.filter((uid) => !prev.includes(uid));
      const removed = prev.filter((uid) => !assigneeIds.includes(uid));
      if (addedAssignees.length || removed.length) {
        const bits = [];
        if (addedAssignees.length) {
          bits.push(
            `added ${addedAssignees.length} member${
              addedAssignees.length === 1 ? "" : "s"
            }`
          );
        }
        if (removed.length) {
          bits.push(
            `removed ${removed.length} member${removed.length === 1 ? "" : "s"}`
          );
        }
        pendingActivity.push({
          userId: actor,
          type: "assignees",
          text: bits.join(" and "),
        });
        card.assignees = assigneeIds;
      }
    }

    if (hasLabel) {
      const next = String(label);
      if (next && !labels.some((item) => item.id === next)) {
        return res.status(400).json({ error: "Invalid label" });
      }
      if (next !== (card.label || "")) {
        const labelName =
          labels.find((item) => item.id === next)?.name || "none";
        pendingActivity.push({
          userId: actor,
          type: "label",
          text: next ? `set the label to “${labelName}”` : "removed the label",
        });
        card.label = next;
      }
    }

    if (hasDeadline) {
      const next = String(deadline);
      if (next !== (card.deadline || "")) {
        pendingActivity.push({
          userId: actor,
          type: "deadline",
          text: next
            ? `changed the due date to ${next}`
            : "removed the due date",
        });
        card.deadline = next;
        delete card.notifiedApproaching;
        delete card.notifiedOverdue;
        deadlineChanged = true;
      }
    }

    if (hasList) {
      const target = lists.find((item) => item.id === listId);
      if (!target) {
        return res.status(400).json({ error: "List not found" });
      }
      if (listId !== found.list.id) {
        const type = listId === "done" ? "complete" : "list";
        const text =
          listId === "done"
            ? "marked this card complete"
            : found.list.id === "done"
              ? `moved this card to ${target.title}`
              : `moved this card to ${target.title}`;
        pendingActivity.push({ userId: actor, type, text });
      }
    }

    card = stripCardFeed(card);
    found.list.cards[found.index] = card;

    if (hasList && listId !== found.list.id) {
      const [moved] = found.list.cards.splice(found.index, 1);
      lists.find((item) => item.id === listId).cards.push(moved);
      card = moved;
    }

    await boardRef.set({ lists }, { merge: true });
    await Promise.all(
      pendingActivity.map((entry) => addActivity(boardId, cardId, entry))
    );

    const finalListId = hasList ? listId : previousListId;
    const boardMeta = {
      boardId,
      boardName: boardData.name || "Untitled board",
      urlName: boardData.urlName,
      actorId: actor,
      card,
    };
    const jobs = [];

    if (finalListId !== "done") {
      if (addedAssignees.length > 0) {
        jobs.push(
          notifyUsers({
            ...boardMeta,
            type: NOTIFICATION_TYPES.assigneeAdded,
            userIds: addedAssignees,
          })
        );
      }

      if (deadlineChanged) {
        jobs.push(
          notifyUsers({
            ...boardMeta,
            type: NOTIFICATION_TYPES.deadlineChanged,
            userIds: card.assignees || [],
            extra: { deadline: card.deadline || "" },
          })
        );
      }
    }

    if (jobs.length > 0) {
      Promise.all(jobs).catch((err) => {
        console.error("Error sending card update notifications:", err);
      });
    }

    res.json({ card: stripCardFeed(card), lists: stripListsFeed(lists) });
  } catch (error) {
    console.error("Error updating card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/board/:id/cards/:cardId/feed
router.get("/:id/cards/:cardId/feed", async (req, res) => {
  try {
    const { id: boardId, cardId } = req.params;
    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const lists = cloneLists(boardSnap.data());
    const found = findCard(lists, cardId);
    if (!found) {
      return res.status(404).json({ error: "Card not found" });
    }

    const stripped = await migrateNestedCard(boardId, found.card);
    if (stripped) {
      found.list.cards[found.index] = stripCardFeed(found.card);
      await boardRef.set({ lists }, { merge: true });
    }

    const feed = await listFeed(boardId, cardId);
    res.json(feed);
  } catch (error) {
    console.error("Error fetching card feed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/board/:id/cards/:cardId/images
router.post("/:id/cards/:cardId/images", async (req, res) => {
  try {
    const { id: boardId, cardId } = req.params;
    const kind = req.body?.kind === "comments" ? "comments" : "description";
    const contentType = String(req.body?.contentType || "");
    const actorId = String(req.body?.actorId || "");

    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const members = boardSnap.data().members || [];
    if (actorId && !members.includes(actorId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const lists = cloneLists(boardSnap.data());
    const found = findCard(lists, cardId);
    if (!found) {
      return res.status(404).json({ error: "Card not found" });
    }

    const buffer = decodeImagePayload(contentType, req.body?.data);
    const path = `boards/${boardId}/cards/${cardId}/${kind}/${randomUUID()}.${extForContentType(contentType)}`;
    const uploaded = await uploadImageBuffer(path, contentType, buffer);
    res.json(uploaded);
  } catch (error) {
    console.error("Error uploading card image:", error);
    res.status(error.status || 500).json({
      error: error.status ? error.message : "Internal server error",
    });
  }
});

// POST /api/board/:id/cards/:cardId/comments
router.post("/:id/cards/:cardId/comments", async (req, res) => {
  try {
    const { id: boardId, cardId } = req.params;
    const actorId = String(req.body?.actorId || "");
    const html = sanitizeHtml(
      req.body?.html || req.body?.text || ""
    );
    if (isEmptyHtml(html)) {
      return res.status(400).json({ error: "Missing text" });
    }

    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const lists = cloneLists(boardSnap.data());
    const found = findCard(lists, cardId);
    if (!found) {
      return res.status(404).json({ error: "Card not found" });
    }

    const needsStrip =
      Array.isArray(found.card.comments) || Array.isArray(found.card.activity);
    await migrateNestedCard(boardId, found.card);
    if (needsStrip) {
      found.list.cards[found.index] = stripCardFeed(found.card);
      await boardRef.set({ lists }, { merge: true });
    }

    const result = await addComment(boardId, cardId, {
      userId: actorId,
      html,
      attachments: req.body?.attachments,
    });

    const boardData = boardSnap.data();
    if (found.list.id !== "done") {
      notifyUsers({
        type: NOTIFICATION_TYPES.commentAdded,
        userIds: found.card.assignees || [],
        actorId,
        boardId,
        boardName: boardData.name || "Untitled board",
        urlName: boardData.urlName,
        card: found.card,
        extra: { commentPreview: htmlToPlain(html) },
      }).catch((err) => {
        console.error("Error sending comment notification:", err);
      });
    }

    res.json({
      comment: result.comment,
      activity: result.activity,
      lists: stripListsFeed(lists),
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/board/:id/cards/:cardId
router.delete("/:id/cards/:cardId", async (req, res) => {
  try {
    const { id: boardId, cardId } = req.params;
    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const lists = cloneLists(boardSnap.data());
    const found = findCard(lists, cardId);
    if (!found) {
      return res.status(404).json({ error: "Card not found" });
    }

    found.list.cards.splice(found.index, 1);
    await boardRef.set({ lists }, { merge: true });
    await deleteCardFeed(boardId, cardId);
    res.json({ lists: stripListsFeed(lists) });
  } catch (error) {
    console.error("Error deleting card:", error);
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
    res.json({ labels, lists: stripListsFeed(lists) });
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
    const addedBy = String(req.body.addedBy || "").trim();
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const boardData = boardSnap.data();
    const existingMembers = boardData.members || [];

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch {
      return res.status(404).json({ error: "User not found" });
    }

    const alreadyMember = existingMembers.includes(userRecord.uid);

    await boardRef.update({
      members: admin.firestore.FieldValue.arrayUnion(userRecord.uid),
    });

    const nextSnap = await boardRef.get();
    const members = nextSnap.data().members || [];
    await updateAlgoliaMembers(boardId, members);
    const memberProfiles = await memberProfilesForUids(members);

    if (!alreadyMember && userRecord.uid !== addedBy) {
      notifyUsers({
        type: NOTIFICATION_TYPES.boardMemberAdded,
        userIds: [userRecord.uid],
        actorId: addedBy,
        boardId,
        boardName: boardData.name || "Untitled board",
        urlName: boardData.urlName,
      }).catch((err) => {
        console.error("Error sending board member notification:", err);
      });
    }

    res.json({ members, memberProfiles });
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
    if (isFeatureBoard(boardId, data)) {
      return res.status(403).json({
        error: "Members cannot be removed from the Feature Requests board",
      });
    }

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
    const memberProfiles = await memberProfilesForUids(members);

    res.json({ members, lists, memberProfiles });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const MAX_BOARD_INFO = 2000;

// PATCH /api/board/:id
router.patch("/:id", async (req, res) => {
  try {
    const boardId = req.params.id;
    if (typeof req.body?.info !== "string") {
      return res.status(400).json({ error: "Missing info" });
    }

    const info = String(req.body.info).trim().substring(0, MAX_BOARD_INFO);
    const boardRef = db.collection("Boards").doc(boardId);
    const boardSnap = await boardRef.get();
    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    if (isFeatureBoard(boardId, boardSnap.data())) {
      return res.status(403).json({
        error: "Feature Requests info cannot be edited",
      });
    }

    await boardRef.set({ info }, { merge: true });
    res.json({ info });
  } catch (error) {
    console.error("Error updating board info:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/board/:id
router.get("/:id", async (req, res) => {
  try {
    const boardId = req.params.id;
    if (boardId === FEATURE_BOARD_ID && req.query.userId) {
      await ensureFeatureBoardMember(String(req.query.userId));
    }

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

    const memberProfiles = await memberProfilesForUids(data.members || []);

    res.json({
      id: boardSnap.id,
      ...data,
      lists: stripListsFeed(lists),
      labels,
      memberProfiles,
    });
  } catch (error) {
    console.error("Error fetching board:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
