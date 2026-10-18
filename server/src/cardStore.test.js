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

  it("keeps postponement summary fields", () => {
    const stored = toStoredCard(
      {
        id: "c1",
        title: "Slip",
        deadline: "2026-10-25",
        originalDeadline: "2026-10-18",
        postponeCount: 1,
        postponedDays: 7,
      },
      "todo"
    );
    assert.equal(stored.originalDeadline, "2026-10-18");
    assert.equal(stored.postponeCount, 1);
    assert.equal(stored.postponedDays, 7);
  });

  it("keeps completedAt and archive flags", () => {
    const stored = toStoredCard(
      {
        id: "c1",
        title: "Done",
        completedAt: "2026-09-01T00:00:00.000Z",
        archived: true,
        archivedAt: "2026-10-01T00:00:00.000Z",
      },
      "done"
    );
    assert.equal(stored.completedAt, "2026-09-01T00:00:00.000Z");
    assert.equal(stored.archived, true);
    assert.equal(stored.archivedAt, "2026-10-01T00:00:00.000Z");
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

  it("omits archived cards from columns but keeps cardIds", () => {
    const board = {
      lists: [
        {
          id: "done",
          title: "Done",
          cardIds: ["c1", "c2"],
        },
      ],
    };
    const lists = assembleLists(board, [
      {
        id: "c1",
        title: "Old",
        listId: "done",
        archived: true,
        completedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "c2",
        title: "Fresh",
        listId: "done",
        completedAt: new Date().toISOString(),
      },
    ]);
    const done = lists.find((list) => list.id === "done");
    assert.deepEqual(done.cardIds, ["c1", "c2"]);
    assert.deepEqual(
      done.cards.map((card) => card.id),
      ["c2"]
    );
  });
});
