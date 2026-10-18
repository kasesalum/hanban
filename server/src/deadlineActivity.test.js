import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calendarDays,
  deadlineActivityText,
  needsSlipBackfill,
  postponedDayCount,
  readDeadlineChange,
  slipSummary,
} from "./deadlineActivity.js";

describe("deadlineActivityText", () => {
  it("says postponed when the due date moves later", () => {
    assert.equal(
      deadlineActivityText("2026-10-18", "2026-10-25"),
      "postponed the due date to 2026-10-25"
    );
  });

  it("says changed when the due date moves earlier", () => {
    assert.equal(
      deadlineActivityText("2026-10-25", "2026-10-18"),
      "changed the due date to 2026-10-18"
    );
  });

  it("says changed when a due date is set for the first time", () => {
    assert.equal(
      deadlineActivityText("", "2026-10-18"),
      "changed the due date to 2026-10-18"
    );
  });

  it("says removed when the due date is cleared", () => {
    assert.equal(
      deadlineActivityText("2026-10-18", ""),
      "removed the due date"
    );
  });
});

describe("calendarDays", () => {
  it("counts calendar days between due dates", () => {
    assert.equal(calendarDays("2026-10-18", "2026-10-25"), 7);
    assert.equal(calendarDays("2026-10-25", "2026-10-18"), -7);
  });

  it("rejects values that are not dates", () => {
    assert.equal(calendarDays("", "2026-10-18"), null);
    assert.equal(calendarDays("October 18", "2026-10-25"), null);
  });
});

describe("postponedDayCount", () => {
  it("keeps only later slips", () => {
    assert.equal(postponedDayCount("2026-10-01", "2026-10-22"), 21);
    assert.equal(postponedDayCount("2026-10-22", "2026-10-01"), 0);
    assert.equal(postponedDayCount("2026-10-01", ""), 0);
  });
});

describe("readDeadlineChange", () => {
  it("reads structured previous and next dates", () => {
    assert.deepEqual(
      readDeadlineChange({
        type: "deadline",
        previous: "2026-10-18",
        next: "2026-10-25",
      }),
      {
        previous: "2026-10-18",
        next: "2026-10-25",
        previousKnown: true,
        legacyPostponed: false,
      }
    );
  });

  it("parses a legacy postpone without a from date", () => {
    assert.deepEqual(
      readDeadlineChange({
        type: "deadline",
        text: "postponed the due date to 2026-10-25",
      }),
      {
        previous: "",
        next: "2026-10-25",
        previousKnown: false,
        legacyPostponed: true,
      }
    );
  });

  it("uses the previous known date when a legacy sentence has no from date", () => {
    assert.deepEqual(
      readDeadlineChange(
        {
          type: "deadline",
          text: "postponed the due date to 2026-11-01",
        },
        "2026-10-25"
      ),
      {
        previous: "2026-10-25",
        next: "2026-11-01",
        previousKnown: true,
        legacyPostponed: false,
      }
    );
  });

  it("parses a removed due date", () => {
    assert.equal(
      readDeadlineChange({ type: "deadline", text: "removed the due date" })
        ?.next,
      ""
    );
  });
});

describe("slipSummary", () => {
  it("keeps the due date from creation as the original", () => {
    const summary = slipSummary(
      { deadline: "2026-10-18" },
      [
        {
          type: "create",
          deadline: "2026-10-18",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ]
    );
    assert.deepEqual(summary, {
      originalDeadline: "2026-10-18",
      postponeCount: 0,
      postponedDays: 0,
    });
  });

  it("counts later moves and the days since the original due date", () => {
    const summary = slipSummary(
      { deadline: "2026-11-01" },
      [
        {
          type: "create",
          deadline: "2026-10-18",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
        {
          type: "deadline",
          previous: "2026-10-18",
          next: "2026-10-25",
          createdAt: "2026-10-05T00:00:00.000Z",
        },
        {
          type: "deadline",
          previous: "2026-10-25",
          next: "2026-11-01",
          createdAt: "2026-10-10T00:00:00.000Z",
        },
      ]
    );
    assert.deepEqual(summary, {
      originalDeadline: "2026-10-18",
      postponeCount: 2,
      postponedDays: 14,
    });
  });

  it("keeps a stored original deadline", () => {
    const summary = slipSummary(
      { deadline: "2026-10-20", originalDeadline: "2026-10-01" },
      [
        {
          type: "deadline",
          previous: "2026-10-18",
          next: "2026-10-20",
          createdAt: "2026-10-10T00:00:00.000Z",
        },
      ]
    );
    assert.equal(summary.originalDeadline, "2026-10-01");
    assert.equal(summary.postponedDays, 19);
  });

  it("measures legacy history from the earliest recorded date", () => {
    const summary = slipSummary(
      { deadline: "2026-11-01" },
      [
        {
          type: "deadline",
          text: "postponed the due date to 2026-10-17",
          createdAt: "2026-10-05T00:00:00.000Z",
        },
        {
          type: "deadline",
          text: "postponed the due date to 2026-11-01",
          createdAt: "2026-10-20T00:00:00.000Z",
        },
      ]
    );
    assert.deepEqual(summary, {
      originalDeadline: "2026-10-17",
      postponeCount: 1,
      postponedDays: 15,
    });
  });

  it("uses the current due date when nothing was ever changed", () => {
    assert.deepEqual(slipSummary({ deadline: "2026-10-18" }, []), {
      originalDeadline: "2026-10-18",
      postponeCount: 0,
      postponedDays: 0,
    });
  });
});

describe("needsSlipBackfill", () => {
  it("is true until both counters are stored", () => {
    assert.equal(needsSlipBackfill({ deadline: "2026-10-18" }), true);
    assert.equal(
      needsSlipBackfill({ postponedDays: 0, postponeCount: 0 }),
      false
    );
  });
});
