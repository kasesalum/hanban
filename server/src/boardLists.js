export const DEFAULT_LISTS = [
  { id: "todo", title: "To Do", cards: [] },
  { id: "blocked", title: "Blocked", cards: [] },
  { id: "in-progress", title: "In Progress", cards: [] },
  { id: "done", title: "Done", cards: [] },
];

export const DEFAULT_LABELS = [
  { id: "Bug", name: "Bug", color: "#ef4444" },
  { id: "Feature", name: "Feature", color: "#3b82f6" },
  { id: "Chore", name: "Chore", color: "#f59e0b" },
  { id: "Idea", name: "Idea", color: "#a855f7" },
];

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function emptyBoardLists() {
  return DEFAULT_LISTS.map((list) => ({
    id: list.id,
    title: list.title,
    cardIds: [],
  }));
}

export function cloneLists(data) {
  const anyNested = (data?.lists || []).some((list) => Array.isArray(list.cards));
  return withDefaultLists(data).map((list) => {
    const next = {
      id: list.id,
      title: list.title,
      cardIds: Array.isArray(list.cardIds)
        ? [...list.cardIds]
        : (list.cards || []).map((card) => card.id).filter(Boolean),
    };
    if (anyNested || Array.isArray(list.cards)) {
      next.cards = (list.cards || []).map((card) => ({ ...card }));
    }
    return next;
  });
}

export function listsHaveNestedCards(data) {
  return (data?.lists || []).some((list) => Array.isArray(list.cards));
}

export function listsPayload(lists, options = {}) {
  const nested = options.nested === true;
  return (lists || []).map((list) => {
    const cardIds = Array.isArray(list.cardIds)
      ? list.cardIds
      : (list.cards || []).map((card) => card.id).filter(Boolean);
    const next = {
      id: list.id,
      title: list.title,
      cardIds,
    };
    if (nested && Array.isArray(list.cards)) {
      next.cards = list.cards;
    }
    return next;
  });
}

export function algoliaBoardRecord(id, data) {
  const { lists, ...rest } = data || {};
  return {
    objectID: id,
    ...rest,
    lists: (lists || []).map((list) => ({
      id: list.id,
      title: list.title,
      cardIds: Array.isArray(list.cardIds)
        ? list.cardIds
        : (list.cards || []).map((card) => card.id).filter(Boolean),
    })),
  };
}

function blockedIds(list) {
  const fromIds = Array.isArray(list?.cardIds)
    ? list.cardIds.filter(Boolean)
    : [];
  const fromCards = (list?.cards || []).map((card) => card.id).filter(Boolean);
  return [...new Set([...fromIds, ...fromCards])];
}

export function withDefaultLists(data) {
  const existing = Array.isArray(data?.lists) ? data.lists : [];
  const keepBlocked =
    existing.length === 0 || existing.some((list) => list.id === "blocked");
  const anyNested = existing.some((list) => Array.isArray(list.cards));
  const byId = new Map(
    existing.map((list) => [
      list.id,
      {
        ...list,
        cards: Array.isArray(list.cards) ? [...list.cards] : list.cards,
        cardIds: Array.isArray(list.cardIds) ? [...list.cardIds] : list.cardIds,
      },
    ])
  );

  const lists = DEFAULT_LISTS.filter(
    (def) => keepBlocked || def.id !== "blocked"
  ).map((def) => {
    const found = byId.get(def.id);
    if (found) {
      byId.delete(def.id);
      return found;
    }
    return {
      id: def.id,
      title: def.title,
      cardIds: [],
      ...(anyNested ? { cards: [] } : {}),
    };
  });

  return lists.concat([...byId.values()]);
}

export function withoutBlockedList(lists) {
  const source = lists || [];
  const blocked = source.find((list) => list.id === "blocked");
  if (!blocked) return source;

  const rest = source.filter((list) => list.id !== "blocked");
  const targetId = rest.some((list) => list.id === "todo")
    ? "todo"
    : rest[0]?.id;
  if (!targetId) return rest;

  const ids = blockedIds(blocked);
  const cards = Array.isArray(blocked.cards) ? blocked.cards : [];

  return rest.map((list) => {
    if (list.id !== targetId) return list;
    const cardIds = [...(list.cardIds || [])];
    for (const id of ids) {
      if (!cardIds.includes(id)) cardIds.push(id);
    }
    const next = { ...list, cardIds };
    if (Array.isArray(list.cards) || cards.length > 0) {
      const nextCards = [...(list.cards || [])];
      for (const card of cards) {
        if (!nextCards.some((item) => item.id === card.id)) nextCards.push(card);
      }
      next.cards = nextCards;
    }
    return next;
  });
}

export function withBlockedList(lists) {
  const source = lists || [];
  if (source.some((list) => list.id === "blocked")) return source;

  const anyCards = source.some((list) => Array.isArray(list.cards));
  const blocked = {
    id: "blocked",
    title: "Blocked",
    cardIds: [],
    ...(anyCards ? { cards: [] } : {}),
  };

  const next = [];
  let inserted = false;
  for (const list of source) {
    next.push(list);
    if (list.id === "todo") {
      next.push(blocked);
      inserted = true;
    }
  }
  if (!inserted) {
    const index = next.findIndex((list) => list.id === "in-progress");
    if (index === -1) next.unshift(blocked);
    else next.splice(index, 0, blocked);
  }
  return next;
}

export function withDefaultLabels(data) {
  if (Array.isArray(data?.labels) && data.labels.length > 0) {
    return data.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    }));
  }
  return DEFAULT_LABELS.map((label) => ({ ...label }));
}

export function normalizeCardLabelIds(card) {
  if (Array.isArray(card?.labels)) {
    return [...new Set(card.labels.map((id) => String(id)).filter(Boolean))];
  }
  if (card?.label) return [String(card.label)];
  return [];
}

export function parseCardLabelIds(body, catalog) {
  let ids;
  if (Array.isArray(body?.labels)) {
    ids = body.labels.map((id) => String(id));
  } else if (typeof body?.label === "string" && body.label) {
    ids = [body.label];
  } else {
    ids = [];
  }
  ids = [...new Set(ids.filter(Boolean))];
  const allowed = new Set((catalog || []).map((item) => item.id));
  if (ids.some((id) => !allowed.has(id))) return null;
  return ids;
}

export function hasCardPatchFields(body) {
  const payload = body || {};
  return (
    (typeof payload.listId === "string" && payload.listId.length > 0) ||
    typeof payload.title === "string" ||
    typeof payload.description === "string" ||
    Array.isArray(payload.assignees) ||
    Array.isArray(payload.labels) ||
    typeof payload.label === "string" ||
    typeof payload.deadline === "string"
  );
}
