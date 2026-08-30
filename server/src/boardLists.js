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

export function withDefaultLists(data) {
  const existing = Array.isArray(data?.lists) ? data.lists : [];
  const byId = new Map(
    existing.map((list) => [
      list.id,
      { ...list, cards: [...(list.cards || [])] },
    ])
  );

  const lists = DEFAULT_LISTS.map((def) => {
    const found = byId.get(def.id);
    if (found) {
      byId.delete(def.id);
      return found;
    }
    return { ...def, cards: [] };
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
