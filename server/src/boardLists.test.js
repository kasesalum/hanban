import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasCardPatchFields,
  pausesNotifications,
  withBlockedList,
  withDefaultLists,
  withoutBlockedList,
} from "./boardLists.js";

describe("hasCardPatchFields", () => {
  it("accepts a labels array payload", () => {
    assert.equal(hasCardPatchFields({ labels: ["Bug"] }), true);
  });

  it("accepts a singular label payload", () => {
    assert.equal(hasCardPatchFields({ label: "Bug" }), true);
  });

  it("rejects actorId alone as missing fields", () => {
    assert.equal(hasCardPatchFields({ actorId: "x" }), false);
  });

  it("accepts a cancel payload", () => {
    assert.equal(hasCardPatchFields({ cancelled: true }), true);
    assert.equal(hasCardPatchFields({ cancelled: false }), true);
  });

  it("accepts a priority payload, including a clear", () => {
    assert.equal(hasCardPatchFields({ priority: "high" }), true);
    assert.equal(hasCardPatchFields({ priority: "" }), true);
  });
});

describe("blocked column", () => {
  const boardLists = [
    { id: "todo", title: "To Do", cardIds: ["a"], cards: [{ id: "a", title: "A" }] },
    {
      id: "blocked",
      title: "Blocked",
      cardIds: ["b"],
      cards: [{ id: "b", title: "B" }],
    },
    { id: "in-progress", title: "In Progress", cardIds: [], cards: [] },
    { id: "done", title: "Done", cardIds: [], cards: [] },
  ];

  it("keeps Blocked when the board still has that list", () => {
    const lists = withDefaultLists({ lists: boardLists });
    assert.deepEqual(
      lists.map((list) => list.id),
      ["on-hold", "todo", "blocked", "in-progress", "done"]
    );
  });

  it("inserts an empty On hold column at the front", () => {
    const lists = withDefaultLists({ lists: boardLists });
    assert.equal(lists[0].id, "on-hold");
    assert.equal(lists[0].title, "On hold");
    assert.deepEqual(lists[0].cardIds, []);
    assert.deepEqual(lists[0].cards, []);
  });

  it("does not put Blocked back after it was removed", () => {
    const lists = withDefaultLists({
      lists: boardLists.filter((list) => list.id !== "blocked"),
    });
    assert.equal(
      lists.some((list) => list.id === "blocked"),
      false
    );
    assert.deepEqual(
      lists.map((list) => list.id),
      ["on-hold", "todo", "in-progress", "done"]
    );
  });

  it("still adds Blocked for a board with no lists yet", () => {
    const lists = withDefaultLists({});
    assert.equal(
      lists.some((list) => list.id === "blocked"),
      true
    );
  });

  it("moves Blocked cards to To Do when the column is removed", () => {
    const lists = withoutBlockedList(boardLists);
    assert.equal(
      lists.some((list) => list.id === "blocked"),
      false
    );
    const todo = lists.find((list) => list.id === "todo");
    assert.deepEqual(todo.cardIds, ["a", "b"]);
    assert.deepEqual(
      todo.cards.map((card) => card.id),
      ["a", "b"]
    );
  });

  it("inserts an empty Blocked column after To Do", () => {
    const lists = withBlockedList(
      boardLists.filter((list) => list.id !== "blocked")
    );
    assert.deepEqual(
      lists.map((list) => list.id),
      ["todo", "blocked", "in-progress", "done"]
    );
    assert.deepEqual(lists[1].cardIds, []);
    assert.deepEqual(lists[1].cards, []);
  });
});

describe("pausesNotifications", () => {
  it("pauses done and on hold", () => {
    assert.equal(pausesNotifications("done"), true);
    assert.equal(pausesNotifications("on-hold"), true);
  });

  it("leaves the other lists active", () => {
    for (const listId of ["todo", "blocked", "in-progress"]) {
      assert.equal(pausesNotifications(listId), false);
    }
  });
});
