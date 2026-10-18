import { buildTicketTimeline, slipTone } from "./ticketTimeline";

describe("slipTone", () => {
  it("turns red once a ticket has slipped two weeks", () => {
    expect(slipTone(0)).toBe("neutral");
    expect(slipTone(13)).toBe("amber");
    expect(slipTone(14)).toBe("red");
  });
});

describe("buildTicketTimeline", () => {
  it("orders creation, member changes, and due-date slips", () => {
    const timeline = buildTicketTimeline(
      { deadline: "2026-10-25", createdAt: "2026-10-01T08:00:00.000Z" },
      [
        {
          id: "create",
          type: "create",
          deadline: "2026-10-18",
          assignees: ["alice"],
          createdAt: "2026-10-01T08:00:00.000Z",
        },
        {
          id: "member",
          type: "assignees",
          added: ["bob"],
          removed: [],
          createdAt: "2026-10-03T08:00:00.000Z",
        },
        {
          id: "due",
          type: "deadline",
          previous: "2026-10-18",
          next: "2026-10-25",
          createdAt: "2026-10-05T08:00:00.000Z",
        },
      ]
    );

    expect(timeline.events.map((event) => event.action)).toEqual([
      "created",
      "members",
      "postponed",
    ]);
    expect(timeline.events[0].next).toBe("2026-10-18");
    expect(timeline.events[0].members).toEqual(["alice"]);
    expect(timeline.events[1].added).toEqual(["bob"]);
    expect(timeline.events[2].days).toBe(7);
    expect(timeline.originalDeadline).toBe("2026-10-18");
    expect(timeline.postponedDays).toBe(7);
    expect(timeline.postponeCount).toBe(1);
  });

  it("shows a legacy postpone without a day count when the earlier date is missing", () => {
    const timeline = buildTicketTimeline(
      { deadline: "2026-11-01", createdAt: "2026-10-01T08:00:00.000Z" },
      [
        {
          id: "first",
          type: "deadline",
          text: "postponed the due date to 2026-10-17",
          createdAt: "2026-10-05T08:00:00.000Z",
        },
        {
          id: "second",
          type: "deadline",
          text: "postponed the due date to 2026-11-01",
          createdAt: "2026-10-20T08:00:00.000Z",
        },
      ]
    );

    expect(timeline.events[1].action).toBe("postponed");
    expect(timeline.events[1].days).toBeNull();
    expect(timeline.events[1].previous).toBe("");
    expect(timeline.events[2].days).toBe(15);
    expect(timeline.originalDeadline).toBe("2026-10-17");
    expect(timeline.postponedDays).toBe(15);
    expect(timeline.postponeCount).toBe(1);
  });

  it("keeps a stored original deadline", () => {
    const timeline = buildTicketTimeline(
      {
        deadline: "2026-10-20",
        originalDeadline: "2026-10-01",
        createdAt: "2026-09-01T08:00:00.000Z",
      },
      []
    );

    expect(timeline.originalDeadline).toBe("2026-10-01");
    expect(timeline.postponedDays).toBe(19);
    expect(timeline.events[0].action).toBe("created");
    expect(timeline.events[0].next).toBe("2026-10-01");
  });

  it("labels an earlier due date and a removal", () => {
    const timeline = buildTicketTimeline(
      { deadline: "", createdAt: "2026-10-01T08:00:00.000Z" },
      [
        {
          id: "create",
          type: "create",
          deadline: "2026-10-25",
          createdAt: "2026-10-01T08:00:00.000Z",
        },
        {
          id: "earlier",
          type: "deadline",
          previous: "2026-10-25",
          next: "2026-10-18",
          createdAt: "2026-10-04T08:00:00.000Z",
        },
        {
          id: "cleared",
          type: "deadline",
          previous: "2026-10-18",
          next: "",
          createdAt: "2026-10-06T08:00:00.000Z",
        },
      ]
    );

    expect(timeline.events.map((event) => event.action)).toEqual([
      "created",
      "earlier",
      "removed",
    ]);
    expect(timeline.postponedDays).toBe(0);
  });

  it("uses legacy member text when ids were not stored", () => {
    const timeline = buildTicketTimeline({ createdAt: "2026-10-01T00:00:00.000Z" }, [
      {
        id: "members",
        type: "assignees",
        text: "added 2 members",
        createdAt: "2026-10-02T00:00:00.000Z",
      },
    ]);

    expect(timeline.events[1].legacyText).toBe("added 2 members");
    expect(timeline.events[1].added).toEqual([]);
  });
});
