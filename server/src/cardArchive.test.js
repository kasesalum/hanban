import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVE_AFTER_MS,
  applyDoneTransition,
  cancelCard,
  isArchiveDue,
  isVisibleOnBoard,
  restoreCard,
  shouldShowInDone,
} from "./cardArchive.js";

const day = 24 * 60 * 60 * 1000;

describe("shouldShowInDone", () => {
  it("hides archived cards", () => {
    assert.equal(
      shouldShowInDone({
        archived: true,
        completedAt: new Date().toISOString(),
      }),
      false
    );
  });

  it("shows a card completed 29 days ago", () => {
    const now = Date.UTC(2026, 9, 15);
    const completedAt = new Date(now - 29 * day).toISOString();
    assert.equal(shouldShowInDone({ completedAt }, now), true);
  });

  it("hides a card completed 30 days ago", () => {
    const now = Date.UTC(2026, 9, 15);
    const completedAt = new Date(now - ARCHIVE_AFTER_MS).toISOString();
    assert.equal(shouldShowInDone({ completedAt }, now), false);
  });
});

describe("isArchiveDue", () => {
  it("is false for cards not in done", () => {
    const completedAt = new Date(Date.now() - 40 * day).toISOString();
    assert.equal(isArchiveDue({ listId: "todo", completedAt }), false);
  });

  it("is true at the 30-day boundary for done cards", () => {
    const now = Date.UTC(2026, 9, 15);
    const completedAt = new Date(now - ARCHIVE_AFTER_MS).toISOString();
    assert.equal(isArchiveDue({ listId: "done", completedAt }, now), true);
  });

  it("is false for cancelled cards", () => {
    const now = Date.UTC(2026, 9, 15);
    const completedAt = new Date(now - ARCHIVE_AFTER_MS).toISOString();
    assert.equal(
      isArchiveDue({ listId: "done", completedAt, cancelled: true }, now),
      false
    );
  });
});

describe("cancelCard", () => {
  it("sets only the cancel flags", () => {
    const next = cancelCard(
      { id: "c1", listId: "todo", title: "Skip" },
      new Date("2026-10-02T00:00:00.000Z")
    );
    assert.equal(next.cancelled, true);
    assert.equal(next.cancelledAt, "2026-10-02T00:00:00.000Z");
    assert.equal(next.completedAt, undefined);
    assert.equal(next.archived, undefined);
    assert.equal(next.archivedAt, undefined);
    assert.equal(next.listId, "todo");
  });
});

describe("restoreCard", () => {
  it("clears cancel flags", () => {
    const next = restoreCard(
      {
        id: "c1",
        listId: "todo",
        cancelled: true,
        cancelledAt: "2026-10-02T00:00:00.000Z",
      },
      new Date("2026-10-03T00:00:00.000Z")
    );
    assert.equal(next.cancelled, undefined);
    assert.equal(next.cancelledAt, undefined);
    assert.equal(next.listId, "todo");
    assert.equal(next.completedAt, undefined);
  });

  it("refreshes completedAt when a Done card is already past the archive window", () => {
    const now = new Date(Date.UTC(2026, 9, 15));
    const completedAt = new Date(now.getTime() - ARCHIVE_AFTER_MS).toISOString();
    const next = restoreCard(
      {
        id: "c1",
        listId: "done",
        cancelled: true,
        cancelledAt: now.toISOString(),
        completedAt,
      },
      now
    );
    assert.equal(next.cancelled, undefined);
    assert.equal(next.cancelledAt, undefined);
    assert.equal(next.completedAt, now.toISOString());
  });
});

describe("isVisibleOnBoard", () => {
  it("hides cancelled cards", () => {
    assert.equal(
      isVisibleOnBoard({ id: "c1", cancelled: true, listId: "todo" }, "todo"),
      false
    );
  });
});

describe("applyDoneTransition", () => {
  it("sets completedAt when moving onto Done", () => {
    const next = applyDoneTransition({ id: "c1" }, "todo", "done");
    assert.equal(next.listId, "done");
    assert.ok(next.completedAt);
  });

  it("clears completion and archive flags when leaving Done", () => {
    const next = applyDoneTransition(
      {
        id: "c1",
        completedAt: "2026-01-01T00:00:00.000Z",
        archived: true,
        archivedAt: "2026-02-01T00:00:00.000Z",
      },
      "done",
      "todo"
    );
    assert.equal(next.listId, "todo");
    assert.equal(next.completedAt, undefined);
    assert.equal(next.archived, undefined);
    assert.equal(next.archivedAt, undefined);
  });
});
