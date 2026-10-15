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

export function withDefaultLists(data) {
  const existing = Array.isArray(data?.lists) ? data.lists : [];
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

  const lists = DEFAULT_LISTS.map((def) => {
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
