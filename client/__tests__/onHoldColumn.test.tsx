import { act, fireEvent, render, screen } from "@testing-library/react";
import BoardPage from "@/app/b/[boardId]/[boardName]/page_client";
import { moveBoardCard } from "../src/lib/helper";

jest.mock("next/navigation", () => {
  const router = { replace: jest.fn(), push: jest.fn() };
  return {
    useRouter: () => router,
    usePathname: () => "/b/board-1/alpha",
  };
});

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: object) => void) => {
    callback({ uid: "me", displayName: "Ada" });
    return () => {};
  },
  signOut: jest.fn(),
}));

jest.mock("../src/lib/firebase", () => ({ auth: {} }));

jest.mock("react-firebase-hooks/auth", () => ({
  useAuthState: () => [{ uid: "me", displayName: "Ada" }, false],
}));

jest.mock("../src/lib/useBoards", () => ({
  useBoardInfo: () => ({
    board: {
      id: "board-1",
      name: "Alpha",
      lists: [
        {
          id: "on-hold",
          title: "On hold",
          cards: [
            {
              id: "paused",
              title: "Paused",
              assignees: [],
              labels: [],
              deadline: "",
            },
          ],
        },
        {
          id: "todo",
          title: "To Do",
          cards: [
            {
              id: "active",
              title: "Active",
              assignees: [],
              labels: [],
              deadline: "",
            },
          ],
        },
        { id: "in-progress", title: "In Progress", cards: [] },
        { id: "done", title: "Done", cards: [] },
      ],
      labels: [],
      members: ["me"],
      memberProfiles: [],
    },
    loading: false,
    missing: false,
  }),
  useBoardCache: () => ({ patchBoard: jest.fn() }),
  useRecentBoards: () => ({ recent: [], loading: false }),
}));

jest.mock("../src/lib/helper", () => ({
  FEATURE_BOARD_ID: "features",
  FEATURE_BOARD_INFO: "",
  moveBoardCard: jest.fn(),
  getUserNotifications: jest.fn().mockResolvedValue({ unreadCount: 0 }),
  getCardFeed: jest.fn().mockResolvedValue({ comments: [], activity: [] }),
  openBoard: jest.fn(),
  globalSearch: jest.fn(),
}));

const movedLists = [
  {
    id: "on-hold",
    title: "On hold",
    cards: [
      {
        id: "paused",
        title: "Paused",
        assignees: [],
        labels: [],
        deadline: "",
      },
      {
        id: "active",
        title: "Active",
        assignees: [],
        labels: [],
        deadline: "",
      },
    ],
  },
  { id: "todo", title: "To Do", cards: [] },
  { id: "in-progress", title: "In Progress", cards: [] },
  { id: "done", title: "Done", cards: [] },
];

function renderBoard() {
  return render(<BoardPage boardId="board-1" boardName="alpha" />);
}

beforeEach(() => {
  localStorage.clear();
  jest.mocked(moveBoardCard).mockReset();
  jest.mocked(moveBoardCard).mockResolvedValue({
    card: {
      id: "active",
      title: "Active",
      assignees: [],
      labels: [],
      deadline: "",
    },
    lists: movedLists,
  });
});

test("On hold starts as a collapsed rail and can expand", async () => {
  renderBoard();

  const expand = await screen.findByRole("button", { name: "Expand On hold" });
  expect(expand).toHaveAttribute("aria-expanded", "false");
  expect(expand.querySelector("[class*='writing-mode']")).toHaveTextContent(
    "On hold"
  );
  expect(expand).toHaveTextContent("1");
  expect(screen.queryByText("Paused")).not.toBeInTheDocument();

  const todo = screen.getByRole("heading", { name: "To Do" });
  expect(
    expand.compareDocumentPosition(todo) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();

  fireEvent.click(expand);

  expect(
    await screen.findByRole("button", { name: "Collapse On hold" })
  ).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("heading", { name: "On hold" })).toBeInTheDocument();
  expect(screen.getByText("Paused")).toBeInTheDocument();
  expect(localStorage.getItem("onHoldCollapsed:board-1")).toBe("0");

  fireEvent.click(screen.getByRole("button", { name: "Collapse On hold" }));

  expect(
    await screen.findByRole("button", { name: "Expand On hold" })
  ).toBeInTheDocument();
  expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  expect(localStorage.getItem("onHoldCollapsed:board-1")).toBe("1");
});

test("a saved preference reopens On hold", async () => {
  localStorage.setItem("onHoldCollapsed:board-1", "0");
  renderBoard();

  expect(
    await screen.findByRole("button", { name: "Collapse On hold" })
  ).toBeInTheDocument();
  expect(screen.getByText("Paused")).toBeInTheDocument();
});

test("dropping a card onto the rail moves it into On hold and expands", async () => {
  renderBoard();
  const rail = await screen.findByRole("button", { name: "Expand On hold" });

  await act(async () => {
    fireEvent.drop(rail, {
      dataTransfer: { getData: () => "active" },
    });
  });

  expect(
    await screen.findByRole("button", { name: "Collapse On hold" })
  ).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByText("Paused")).toBeInTheDocument();
  expect(moveBoardCard).toHaveBeenCalledWith(
    "board-1",
    "active",
    "on-hold",
    "me"
  );
});

test("the card menu can move a ticket into On hold", async () => {
  renderBoard();
  fireEvent.click(await screen.findByText("Active"));

  const listSelect = (await screen.findAllByRole("combobox")).find(
    (element) => (element as HTMLSelectElement).value === "todo"
  );
  expect(listSelect).toBeTruthy();
  expect(
    Array.from((listSelect as HTMLSelectElement).options).map(
      (option) => option.text
    )
  ).toEqual(["On hold", "To Do", "In Progress", "Done"]);

  await act(async () => {
    fireEvent.change(listSelect as HTMLSelectElement, {
      target: { value: "on-hold" },
    });
  });

  expect(moveBoardCard).toHaveBeenCalledWith(
    "board-1",
    "active",
    "on-hold",
    "me"
  );
});
