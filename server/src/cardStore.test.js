import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assembleLists, toStoredCard } from "./cardStore.js";

describe("toStoredCard", () => {
  it("normalizes a legacy singular label", () => {
    const stored = toStoredCard(
      { id: "c1", title: "Fix", label: "Bug" },
      "todo"
    );
    assert.equal(stored.listId, "todo");
    assert.deepEqual(stored.labels, ["Bug"]);
    assert.equal(stored.label, undefined);
  });
});

describe("assembleLists", () => {
  it("falls back to nested cards when the subcollection is empty", () => {
    const nested = {
      lists: [
        {
          id: "todo",
          title: "To Do",
          cards: [{ id: "c1", title: "Nested" }],
        },
      ],
    };
    const lists = assembleLists(nested, []);
    const todo = lists.find((list) => list.id === "todo");
    assert.equal(todo.cards[0].title, "Nested");
  });

  it("prefers subcollection docs in cardIds order", () => {
    const board = {
      lists: [
        {
          id: "todo",
          title: "To Do",
          cardIds: ["c2", "c1"],
          cards: [{ id: "c1", title: "Stale" }],
        },
      ],
    };
    const lists = assembleLists(board, [
      { id: "c1", title: "One", listId: "todo" },
      { id: "c2", title: "Two", listId: "todo" },
    ]);
    const todo = lists.find((list) => list.id === "todo");
    assert.deepEqual(
      todo.cards.map((card) => card.id),
      ["c2", "c1"]
    );
    assert.equal(todo.cards[1].title, "One");
  });
});
