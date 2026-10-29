import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupUserTickets } from "./userTickets.js";

const boardLabels = [{ id: "Bug", name: "Bug", color: "#ef4444" }];

function board(cards) {
  return {
    id: "board-1",
    name: "Alpha",
    urlName: "alpha",
    labels: boardLabels,
    cards,
  };
}

describe("groupUserTickets", () => {
  it("keeps assigned to do and in progress tickets", () => {
    const result = groupUserTickets("me", [
      board([
        { id: "a", title: "Write spec", listId: "todo", assignees: ["me"] },
        {
          id: "b",
          title: "Build it",
          listId: "in-progress",
          assignees: ["me", "other"],
          labels: ["Bug"],
          deadline: "2026-10-20",
          postponedDays: 21,
        },
      ]),
    ]);

    assert.deepEqual(
      result.todo.map((ticket) => ticket.id),
      ["a"]
    );
    assert.deepEqual(
      result.inProgress.map((ticket) => ticket.id),
      ["b"]
    );
    assert.equal(result.inProgress[0].boardId, "board-1");
    assert.equal(result.inProgress[0].boardName, "Alpha");
    assert.equal(result.inProgress[0].urlName, "alpha");
    assert.deepEqual(result.inProgress[0].labels, ["Bug"]);
    assert.equal(result.inProgress[0].postponedDays, 21);
    assert.deepEqual(result.inProgress[0].boardLabels, boardLabels);
  });

  it("drops done, blocked, archived, cancelled, and unassigned cards", () => {
    const result = groupUserTickets("me", [
      board([
        { id: "done", title: "Done", listId: "done", assignees: ["me"] },
        {
          id: "blocked",
          title: "Blocked",
          listId: "blocked",
          assignees: ["me"],
        },
        {
          id: "archived",
          title: "Archived",
          listId: "todo",
          assignees: ["me"],
          archived: true,
        },
        {
          id: "cancelled",
          title: "Cancelled",
          listId: "todo",
          assignees: ["me"],
          cancelled: true,
        },
        {
          id: "other",
          title: "Someone else",
          listId: "todo",
          assignees: ["other"],
        },
        { id: "none", title: "Unassigned", listId: "in-progress", assignees: [] },
      ]),
    ]);

    assert.deepEqual(result.todo, []);
    assert.deepEqual(result.inProgress, []);
  });

  it("sorts overdue deadlines first, then soonest deadline, then title", () => {
    const result = groupUserTickets("me", [
      board([
        {
          id: "later",
          title: "Later",
          listId: "todo",
          assignees: ["me"],
          deadline: "2026-12-01",
        },
        {
          id: "zeta",
          title: "Zeta",
          listId: "todo",
          assignees: ["me"],
        },
        {
          id: "alpha",
          title: "Alpha",
          listId: "todo",
          assignees: ["me"],
        },
        {
          id: "overdue",
          title: "Overdue",
          listId: "todo",
          assignees: ["me"],
          deadline: "2026-10-01",
        },
        {
          id: "soon",
          title: "Soon",
          listId: "todo",
          assignees: ["me"],
          deadline: "2026-10-19",
        },
      ]),
    ]);

    assert.deepEqual(
      result.todo.map((ticket) => ticket.id),
      ["overdue", "soon", "later", "alpha", "zeta"]
    );
  });
});
