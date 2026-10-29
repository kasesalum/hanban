import {
  defaultSortForList,
  groupCardsByCancelledMonth,
  groupCardsByCompletedMonth,
  isDoneVisible,
  sortCards,
} from "./cardSort";

describe("defaultSortForList", () => {
  it("uses completed-desc for Done", () => {
    expect(defaultSortForList("done")).toBe("completed-desc");
  });

  it("uses deadline-asc for other columns", () => {
    expect(defaultSortForList("todo")).toBe("deadline-asc");
  });
});

describe("groupCardsByCompletedMonth", () => {
  it("groups newest month first", () => {
    const groups = groupCardsByCompletedMonth([
      { id: "a", title: "Jan", completedAt: "2026-01-15T00:00:00.000Z" },
      { id: "b", title: "Mar", completedAt: "2026-03-02T00:00:00.000Z" },
      { id: "c", title: "Mar later", completedAt: "2026-03-20T00:00:00.000Z" },
    ]);
    expect(groups.map((group) => group.key)).toEqual(["2026-03", "2026-01"]);
    expect(groups[0].cards.map((card) => card.id)).toEqual(["b", "c"]);
  });
});

describe("groupCardsByCancelledMonth", () => {
  it("groups by cancelledAt", () => {
    const groups = groupCardsByCancelledMonth([
      {
        id: "a",
        title: "January",
        cancelledAt: "2026-01-15T00:00:00.000Z",
        createdAt: "2025-06-01T00:00:00.000Z",
      },
      {
        id: "b",
        title: "March",
        cancelledAt: "2026-03-02T00:00:00.000Z",
        createdAt: "2025-06-01T00:00:00.000Z",
      },
    ]);
    expect(groups.map((group) => group.key)).toEqual(["2026-03", "2026-01"]);
    expect(groups[0].cards.map((card) => card.id)).toEqual(["b"]);
  });
});

describe("isDoneVisible", () => {
  it("hides archived cards", () => {
    expect(
      isDoneVisible({
        id: "a",
        title: "Old",
        archived: true,
        completedAt: new Date().toISOString(),
      })
    ).toBe(false);
  });
});

describe("sortCards", () => {
  it("orders completed newest first", () => {
    const sorted = sortCards(
      [
        { id: "a", title: "Older", completedAt: "2026-01-01T00:00:00.000Z" },
        { id: "b", title: "Newer", completedAt: "2026-09-01T00:00:00.000Z" },
      ],
      "completed-desc"
    );
    expect(sorted.map((card) => card.id)).toEqual(["b", "a"]);
  });
});
