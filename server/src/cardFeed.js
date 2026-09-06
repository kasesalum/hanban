import { randomUUID } from "crypto";
import { db, getBucket } from "./firebase.js";
import {
  htmlToPlain,
  looksLikeHtml,
  sanitizeHtml,
  textToHtml,
} from "./htmlSanitize.js";

const BATCH_LIMIT = 400;

export function commentsCol(boardId) {
  return db.collection("Boards").doc(boardId).collection("comments");
}

export function activityCol(boardId) {
  return db.collection("Boards").doc(boardId).collection("activity");
}

export function stripCardFeed(card) {
  const next = { ...card };
  delete next.comments;
  delete next.activity;
  return next;
}

export function stripListsFeed(lists) {
  return (lists || []).map((list) => ({
    ...list,
    cards: (list.cards || []).map(stripCardFeed),
  }));
}

export function normalizeAttachments(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input.slice(0, 20)) {
    const url = String(item?.url || "");
    const path = String(item?.path || "");
    if (!url || !path) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (path.includes("..") || path.startsWith("/")) continue;
    out.push({ url, path });
  }
  return out;
}

function commentDoc(cardId, comment) {
  const raw = comment.html || comment.text || "";
  const html = looksLikeHtml(raw) ? sanitizeHtml(raw) : textToHtml(raw);
  return {
    cardId,
    userId: comment.userId || "",
    html,
    attachments: normalizeAttachments(comment.attachments),
    createdAt: comment.createdAt || new Date().toISOString(),
  };
}

async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      if (op.type === "set") batch.set(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }
}

export async function addActivity(boardId, cardId, { userId, type, text, commentId }) {
  const id = randomUUID();
  const entry = {
    cardId,
    userId: userId || "",
    type,
    text: String(text || ""),
    createdAt: new Date().toISOString(),
  };
  if (commentId) entry.commentId = commentId;
  await activityCol(boardId).doc(id).set(entry);
  return { id, ...entry };
}

export async function addComment(boardId, cardId, { userId, html, attachments }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const comment = {
    cardId,
    userId: userId || "",
    html,
    attachments: normalizeAttachments(attachments),
    createdAt,
  };
  await commentsCol(boardId).doc(id).set(comment);
  const activity = await addActivity(boardId, cardId, {
    userId,
    type: "comment",
    text: htmlToPlain(html).substring(0, 200),
    commentId: id,
  });
  return { comment: { id, ...comment }, activity };
}

function serializeSnap(snap) {
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function listFeed(boardId, cardId) {
  const [commentsSnap, activitySnap] = await Promise.all([
    commentsCol(boardId).where("cardId", "==", cardId).get(),
    activityCol(boardId).where("cardId", "==", cardId).get(),
  ]);

  const comments = serializeSnap(commentsSnap);
  const activity = serializeSnap(activitySnap).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { comments, activity };
}

export async function migrateNestedCard(boardId, card) {
  const nestedComments = Array.isArray(card.comments) ? card.comments : [];
  const nestedActivity = Array.isArray(card.activity) ? card.activity : [];
  const hasNested = nestedComments.length > 0 || nestedActivity.length > 0;

  const [commentsSnap, activitySnap] = await Promise.all([
    commentsCol(boardId).where("cardId", "==", card.id).limit(1).get(),
    activityCol(boardId).where("cardId", "==", card.id).limit(1).get(),
  ]);

  if (!hasNested || !commentsSnap.empty || !activitySnap.empty) {
    return hasNested;
  }

  const ops = [];
  for (const comment of nestedComments) {
    const id = comment.id || randomUUID();
    ops.push({
      type: "set",
      ref: commentsCol(boardId).doc(id),
      data: commentDoc(card.id, comment),
    });
  }

  for (const entry of nestedActivity) {
    const id = entry.id || randomUUID();
    const data = {
      cardId: card.id,
      userId: entry.userId || "",
      type: entry.type || "comment",
      text: String(entry.text || ""),
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    if (entry.type === "comment") {
      const match = nestedComments.find(
        (comment) =>
          comment.createdAt === entry.createdAt || comment.text === entry.text
      );
      if (match?.id) data.commentId = match.id;
    }
    ops.push({
      type: "set",
      ref: activityCol(boardId).doc(id),
      data,
    });
  }

  await commitOps(ops);
  return true;
}

export async function deleteCardFeed(boardId, cardId) {
  const [commentsSnap, activitySnap] = await Promise.all([
    commentsCol(boardId).where("cardId", "==", cardId).get(),
    activityCol(boardId).where("cardId", "==", cardId).get(),
  ]);

  const ops = [
    ...commentsSnap.docs.map((doc) => ({ type: "delete", ref: doc.ref })),
    ...activitySnap.docs.map((doc) => ({ type: "delete", ref: doc.ref })),
  ];
  await commitOps(ops);

  try {
    const bucket = getBucket();
    if (!bucket) return;
    const [files] = await bucket.getFiles({
      prefix: `boards/${boardId}/cards/${cardId}/`,
    });
    await Promise.all(files.map((file) => file.delete().catch(() => {})));
  } catch (err) {
    console.error("Error deleting card attachments:", err);
  }
}
