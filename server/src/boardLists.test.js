import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasCardPatchFields,
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
      ["todo", "blocked", "in-progress", "done"]
    );
  });

  it("does not put Blocked back after it was removed", () => {
    const lists = withDefaultLists({
      lists: boardLists.filter((list) => list.id !== "blocked"),
    });
    assert.equal(
      lists.some((list) => list.id === "blocked"),
      false
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
