import { fireEvent, render, screen } from "@testing-library/react";
import { PostponeChip } from "@/components/boards/postponeChip";
import TicketTimeline from "@/components/boards/ticketTimeline";

test("draws creation, members, and a two-week postponement", () => {
  render(
    <TicketTimeline
      card={{
        deadline: "2026-11-01",
        createdAt: "2026-10-01T12:00:00.000Z",
      }}
      activity={[
        {
          id: "create",
          type: "create",
          deadline: "2026-10-18",
          assignees: ["alice"],
          createdAt: "2026-10-01T12:00:00.000Z",
        },
        {
          id: "member",
          type: "assignees",
          added: ["bob"],
          removed: [],
          createdAt: "2026-10-02T12:00:00.000Z",
        },
        {
          id: "due",
          type: "deadline",
          previous: "2026-10-18",
          next: "2026-11-01",
          createdAt: "2026-10-05T12:00:00.000Z",
        },
      ]}
      memberProfiles={[
        { uid: "alice", displayName: "Alice" },
        { uid: "bob", displayName: "Bob" },
      ]}
    />
  );

  expect(screen.getByText("Postponed 14 days")).toBeInTheDocument();
  expect(screen.getByText("+14 days")).toBeInTheDocument();
  expect(screen.getByText("Created")).toBeInTheDocument();
  expect(screen.getByText(/Alice/)).toBeInTheDocument();
  expect(screen.getByText("Added Bob")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Timeline/ }));
  expect(screen.queryByText("+14 days")).not.toBeInTheDocument();
  expect(screen.getByText("Postponed 14 days")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Timeline/ }));
  expect(screen.getByText("+14 days")).toBeInTheDocument();
});

test("shows a postponement chip once the due date has slipped", () => {
  const { rerender } = render(<PostponeChip days={0} />);
  expect(screen.queryByText(/Postponed/)).not.toBeInTheDocument();

  rerender(<PostponeChip days={14} />);
  expect(screen.getByText("Postponed 14d")).toBeInTheDocument();
});
