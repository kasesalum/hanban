import {
  cloneLists,
  listsHaveNestedCards,
  listsPayload,
  normalizeCardLabelIds,
} from "./boardLists.js";
import { stripCardFeed } from "./cardFeed.js";

async function getDb() {
  const { db } = await import("./firebase.js");
  return db;
}

export async function cardsCol(boardId) {
  const db = await getDb();
  return db.collection("Boards").doc(boardId).collection("cards");
}

export function toStoredCard(card, listId) {
  const stored = {
    id: card.id,
    listId: listId || card.listId || "",
    title: card.title || "",
    description: card.description || "",
    assignees: Array.isArray(card.assignees) ? card.assignees : [],
    labels: normalizeCardLabelIds(card),
    deadline: card.deadline || "",
    createdAt: card.createdAt || new Date().toISOString(),
    createdBy: card.createdBy || "",
  };
  if (Array.isArray(card.descriptionAttachments)) {
    stored.descriptionAttachments = card.descriptionAttachments;
  }
  if (card.notifiedApproaching) stored.notifiedApproaching = true;
  if (card.notifiedOverdue) stored.notifiedOverdue = true;
  return stored;
}

export function fromCardDoc(id, data) {
  const card = { id, ...(data || {}) };
  if (!Array.isArray(card.labels)) {
    card.labels = normalizeCardLabelIds(card);
  }
  delete card.label;
  return stripCardFeed(card);
}

export function nestedCardForList(card, listId) {
  const stored = toStoredCard(card, listId);
  const { listId: _listId, ...rest } = stored;
  return rest;
}

export function assembleLists(boardData, cardDocs) {
  const byId = new Map(
    (cardDocs || []).map((card) => [card.id, stripCardFeed({ ...card })])
  );
  const lists = cloneLists(boardData);
  if (!cardDocs?.length) return lists;

  const used = new Set();
  const next = lists.map((list) => {
    const ids =
      Array.isArray(list.cardIds) && list.cardIds.length
        ? list.cardIds
        : (list.cards || []).map((card) => card.id).filter(Boolean);
    const cards = ids
      .map((id) => {
        used.add(id);
        return (
          byId.get(id) ||
          (list.cards || []).find((card) => card.id === id) ||
          null
        );
      })
      .filter(Boolean)
      .map((card) => stripCardFeed(card));
    const assembled = { ...list, cardIds: ids, cards };
    return assembled;
  });

  for (const card of cardDocs) {
    if (used.has(card.id)) continue;
    const list = next.find((item) => item.id === card.listId) || next[0];
    if (!list) continue;
    list.cards = list.cards || [];
    list.cardIds = list.cardIds || [];
    list.cards.push(stripCardFeed(card));
    if (!list.cardIds.includes(card.id)) list.cardIds.push(card.id);
  }

  return next;
}

export async function loadCardDocs(boardId) {
  const col = await cardsCol(boardId);
  const snap = await col.get();
  return snap.docs.map((doc) => fromCardDoc(doc.id, doc.data()));
}

export async function loadAssembledLists(boardId, boardData) {
  const cardDocs = await loadCardDocs(boardId);
  return assembleLists(boardData, cardDocs);
}

export function findCard(lists, cardId) {
  for (const list of lists) {
    const index = (list.cards || []).findIndex((item) => item.id === cardId);
    if (index !== -1) {
      return { list, index, card: list.cards[index] };
    }
  }
  return null;
}

export async function writeCardDoc(boardId, card, listId) {
  const stored = toStoredCard(card, listId);
  const col = await cardsCol(boardId);
  await col.doc(stored.id).set(stored);
  return stored;
}

export async function deleteCardDoc(boardId, cardId) {
  const col = await cardsCol(boardId);
  await col.doc(cardId).delete();
}

export async function saveBoardLists(boardRef, lists, boardData) {
  await boardRef.set(
    {
      lists: listsPayload(lists, {
        nested: listsHaveNestedCards(boardData),
      }),
    },
    { merge: true }
  );
}

export function applyCardToLists(lists, card, listId) {
  const next = cloneLists({ lists });
  const target = next.find((list) => list.id === listId);
  if (!target) return next;

  for (const list of next) {
    list.cardIds = (list.cardIds || []).filter((id) => id !== card.id);
    if (Array.isArray(list.cards)) {
      list.cards = list.cards.filter((item) => item.id !== card.id);
    }
  }

  target.cardIds = target.cardIds || [];
  if (!target.cardIds.includes(card.id)) target.cardIds.push(card.id);
  if (Array.isArray(target.cards)) {
    target.cards.push(nestedCardForList(card, listId));
  }
  return next;
}

export function removeCardFromLists(lists, cardId) {
  return cloneLists({ lists }).map((list) => {
    const next = {
      ...list,
      cardIds: (list.cardIds || []).filter((id) => id !== cardId),
    };
    if (Array.isArray(list.cards)) {
      next.cards = list.cards.filter((item) => item.id !== cardId);
    }
    return next;
  });
}

export function moveCardInLists(lists, cardId, fromListId, toListId) {
  const next = cloneLists({ lists });
  const from = next.find((list) => list.id === fromListId);
  const to = next.find((list) => list.id === toListId);
  if (!from || !to) return next;

  from.cardIds = (from.cardIds || []).filter((id) => id !== cardId);
  to.cardIds = to.cardIds || [];
  if (!to.cardIds.includes(cardId)) to.cardIds.push(cardId);

  if (Array.isArray(from.cards) || Array.isArray(to.cards)) {
    let moved = null;
    if (Array.isArray(from.cards)) {
      const index = from.cards.findIndex((item) => item.id === cardId);
      if (index !== -1) {
        [moved] = from.cards.splice(index, 1);
      }
    }
    if (Array.isArray(to.cards)) {
      to.cards.push(moved || { id: cardId });
    }
  }

  return next;
}

export function replaceCardInLists(lists, card) {
  return cloneLists({ lists }).map((list) => {
    if (!Array.isArray(list.cards)) return list;
    return {
      ...list,
      cards: list.cards.map((item) =>
        item.id === card.id ? nestedCardForList(card, list.id) : item
      ),
    };
  });
}
