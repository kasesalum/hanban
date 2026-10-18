import { normalizeCardLabelIds, withDefaultLabels } from "./boardLists.js";

const ACTIVE_LISTS = new Set(["todo", "in-progress"]);

function toTicket(board, card, boardLabels) {
  return {
    id: card.id,
    title: card.title || "",
    description: card.description || "",
    assignees: Array.isArray(card.assignees) ? card.assignees : [],
    labels: normalizeCardLabelIds(card),
    deadline: card.deadline || "",
    postponedDays: Number(card.postponedDays) || 0,
    listId: card.listId,
    boardId: board.id,
    boardName: board.name || "",
    urlName: board.urlName || "",
    boardLabels,
  };
}

function compareTickets(a, b) {
  const aDated = Boolean(a.deadline);
  const bDated = Boolean(b.deadline);
  if (aDated !== bDated) return aDated ? -1 : 1;
  if (aDated && a.deadline !== b.deadline) {
    return a.deadline < b.deadline ? -1 : 1;
  }
  return a.title.localeCompare(b.title);
}

export function groupUserTickets(userId, boards) {
  const todo = [];
  const inProgress = [];

  for (const board of boards || []) {
    const boardLabels = withDefaultLabels(board);
    for (const card of board.cards || []) {
      if (!card || card.archived) continue;
      if (!ACTIVE_LISTS.has(card.listId)) continue;
      const assignees = Array.isArray(card.assignees) ? card.assignees : [];
      if (!assignees.includes(userId)) continue;

      const ticket = toTicket(board, card, boardLabels);
      if (card.listId === "todo") todo.push(ticket);
      else inProgress.push(ticket);
    }
  }

  todo.sort(compareTickets);
  inProgress.sort(compareTickets);
  return { todo, inProgress };
}
