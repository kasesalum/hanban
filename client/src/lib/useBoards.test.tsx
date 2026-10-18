import { render, screen, waitFor } from "@testing-library/react";
import { getBoardInfo, getRecentBoards, getUserBoards } from "./helper";
import { BoardsProvider, useBoardInfo, useRecentBoards, useUserBoards } from "./useBoards";

jest.mock("./helper", () => ({
  getUserBoards: jest.fn(),
  getBoardInfo: jest.fn(),
  getRecentBoards: jest.fn(),
}));

function ListProbe({ userId }: { userId: string }) {
  const { boards, loading } = useUserBoards(userId);
  const recent = useRecentBoards(userId);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="count">{boards.length}</span>
      <span data-testid="recent">{recent.map((board) => board.label).join(",")}</span>
    </div>
  );
}

function BoardProbe({ boardId, userId }: { boardId: string; userId: string }) {
  const { board, loading } = useBoardInfo(boardId, userId);
  return (
    <div>
      <span data-testid="board-loading">{String(loading)}</span>
      <span data-testid="board-name">{board?.name || ""}</span>
    </div>
  );
}

function Pages({ page }: { page: "list" | "detail" }) {
  return page === "list" ? (
    <ListProbe userId="user-1" />
  ) : (
    <BoardProbe boardId="b1" userId="user-1" />
  );
}

const mockedGetUserBoards = jest.mocked(getUserBoards);
const mockedGetBoardInfo = jest.mocked(getBoardInfo);
const mockedGetRecentBoards = jest.mocked(getRecentBoards);

describe("board composables", () => {
  beforeEach(() => {
    mockedGetRecentBoards.mockResolvedValue(["b1", "missing"]);
    mockedGetUserBoards.mockResolvedValue({
      boards: [
        {
          objectID: "b1",
          id: "b1",
          name: "Alpha",
          urlName: "alpha",
          ownerId: "user-1",
          members: ["user-1"],
          privacy: "private",
          pinned: false,
          createdAt: null,
        },
        {
          objectID: "b2",
          id: "b2",
          name: "Beta",
          urlName: "beta",
          ownerId: "user-1",
          members: ["user-1"],
          privacy: "private",
          pinned: false,
          createdAt: null,
        },
      ],
      pinned: ["b1"],
    });
    mockedGetBoardInfo.mockImplementation(async (boardId: string) => {
      if (boardId === "missing") return null;
      return {
        id: boardId,
        name: "Alpha",
        urlName: "alpha",
        lists: [{ id: "todo", title: "To Do", cards: [] }],
      };
    });
  });

  it("loads the board list once and reuses it across page changes", async () => {
    const ui = (page: "list" | "detail") => (
      <BoardsProvider>
        <Pages page={page} />
      </BoardsProvider>
    );
    const { rerender } = render(ui("list"));

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("2");
    });
    await waitFor(() => {
      expect(screen.getByTestId("recent").textContent).toBe("Alpha");
    });

    await waitFor(() => {
      expect(mockedGetBoardInfo).toHaveBeenCalledWith("missing", "user-1");
    });
    expect(mockedGetUserBoards).toHaveBeenCalledTimes(1);
    expect(mockedGetBoardInfo).not.toHaveBeenCalledWith("b1", "user-1");

    rerender(ui("detail"));
    await waitFor(() => {
      expect(screen.getByTestId("board-name").textContent).toBe("Alpha");
    });

    rerender(ui("list"));
    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("2");
    });
    rerender(ui("detail"));
    await waitFor(() => {
      expect(screen.getByTestId("board-loading").textContent).toBe("false");
    });

    expect(mockedGetUserBoards).toHaveBeenCalledTimes(1);
    expect(mockedGetBoardInfo.mock.calls.filter((call) => call[0] === "b1")).toHaveLength(
      1
    );
  });
});
