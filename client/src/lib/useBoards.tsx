"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getBoardInfo, getRecentBoards, getUserBoards } from "./helper";

type BoardRecord = {
  id?: string;
  objectID?: string;
  name?: string;
  urlName?: string;
  pinned?: boolean;
  [key: string]: unknown;
};

type UserBoardsState = {
  boards: BoardRecord[];
  pinned: string[];
};

type BoardsContextValue = {
  userBoardsByUser: Record<string, UserBoardsState>;
  boardsById: Record<string, BoardRecord>;
  missingIds: Record<string, true>;
  listEpoch: Record<string, number>;
  ensureUserBoards: (userId: string) => Promise<UserBoardsState>;
  ensureBoardInfo: (boardId: string, userId?: string) => Promise<BoardRecord | null>;
  setPinned: (userId: string, boardId: string, pinned: boolean) => void;
  upsertBoard: (userId: string, board: BoardRecord) => void;
  patchBoard: (boardId: string, patch: object) => void;
  invalidateBoard: (boardId: string) => void;
  invalidateUserBoards: (userId: string) => void;
};

const BoardsContext = createContext<BoardsContextValue | null>(null);

const EMPTY_BOARDS: BoardRecord[] = [];
const EMPTY_PINNED: string[] = [];

export function boardKey(board: { id?: string; objectID?: string }) {
  return board.id || board.objectID || "";
}

function withPin(board: BoardRecord, pinned: string[]): BoardRecord {
  return { ...board, pinned: pinned.includes(boardKey(board)) };
}

export function BoardsProvider({ children }: { children: ReactNode }) {
  const [userBoardsByUser, setUserBoardsByUser] = useState<
    Record<string, UserBoardsState>
  >({});
  const [boardsById, setBoardsById] = useState<Record<string, BoardRecord>>({});
  const [missingIds, setMissingIds] = useState<Record<string, true>>({});
  const [listEpoch, setListEpoch] = useState<Record<string, number>>({});

  const userBoardsRef = useRef(userBoardsByUser);
  const boardsRef = useRef(boardsById);
  userBoardsRef.current = userBoardsByUser;
  boardsRef.current = boardsById;

  const userInflight = useRef(new Map<string, Promise<UserBoardsState>>());
  const boardInflight = useRef(new Map<string, Promise<BoardRecord | null>>());
  const userFetchGen = useRef(new Map<string, number>());
  const boardFetchGen = useRef(new Map<string, number>());
  const pendingBoards = useRef(new Map<string, BoardRecord[]>());
  const pendingPins = useRef(new Map<string, Map<string, boolean>>());

  const applyPending = useCallback((userId: string, data: UserBoardsState) => {
    const pins = pendingPins.current.get(userId);
    let pinned = [...data.pinned];
    if (pins) {
      for (const [id, isPinned] of pins) {
        pinned = pinned.filter((entry) => entry !== id);
        if (isPinned) pinned.push(id);
      }
    }
    pendingPins.current.delete(userId);

    const extras = pendingBoards.current.get(userId) ?? [];
    pendingBoards.current.delete(userId);
    const seen = new Set(data.boards.map(boardKey));
    const boards = data.boards.map((board) => withPin(board, pinned));
    for (const extra of extras) {
      const id = boardKey(extra);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      boards.push(withPin(extra, pinned));
    }
    return { boards, pinned };
  }, []);

  const ensureUserBoards = useCallback(
    (userId: string) => {
      const cached = userBoardsRef.current[userId];
      if (cached) return Promise.resolve(cached);

      const inflight = userInflight.current.get(userId);
      if (inflight) return inflight;

      const gen = userFetchGen.current.get(userId) ?? 0;
      let promise!: Promise<UserBoardsState>;
      promise = getUserBoards(userId)
        .then((data) => {
          if (userInflight.current.get(userId) === promise) {
            userInflight.current.delete(userId);
          }
          if ((userFetchGen.current.get(userId) ?? 0) !== gen) {
            return userBoardsRef.current[userId] ?? data;
          }
          const next = applyPending(userId, data);
          userBoardsRef.current = { ...userBoardsRef.current, [userId]: next };
          setUserBoardsByUser(userBoardsRef.current);
          return next;
        })
        .catch((err) => {
          if (userInflight.current.get(userId) === promise) {
            userInflight.current.delete(userId);
          }
          throw err;
        });

      userInflight.current.set(userId, promise);
      return promise;
    },
    [applyPending]
  );

  const ensureBoardInfo = useCallback((boardId: string, userId?: string) => {
    const cached = boardsRef.current[boardId];
    if (cached) return Promise.resolve(cached);

    const inflight = boardInflight.current.get(boardId);
    if (inflight) return inflight;

    const gen = boardFetchGen.current.get(boardId) ?? 0;
    let promise!: Promise<BoardRecord | null>;
    promise = getBoardInfo(boardId, userId)
      .then((info) => {
        if (boardInflight.current.get(boardId) === promise) {
          boardInflight.current.delete(boardId);
        }
        if ((boardFetchGen.current.get(boardId) ?? 0) !== gen) {
          return boardsRef.current[boardId] ?? info;
        }
        if (!info) {
          setMissingIds((prev) =>
            prev[boardId] ? prev : { ...prev, [boardId]: true }
          );
          if (boardsRef.current[boardId]) {
            const next = { ...boardsRef.current };
            delete next[boardId];
            boardsRef.current = next;
            setBoardsById(next);
          }
          return null;
        }
        const record = info as BoardRecord;
        boardsRef.current = { ...boardsRef.current, [boardId]: record };
        setBoardsById(boardsRef.current);
        setMissingIds((prev) => {
          if (!prev[boardId]) return prev;
          const next = { ...prev };
          delete next[boardId];
          return next;
        });
        return record;
      })
      .catch((err) => {
        if (boardInflight.current.get(boardId) === promise) {
          boardInflight.current.delete(boardId);
        }
        throw err;
      });

    boardInflight.current.set(boardId, promise);
    return promise;
  }, []);

  const setPinned = useCallback(
    (userId: string, boardId: string, pinned: boolean) => {
      const current = userBoardsRef.current[userId];
      if (!current) {
        const pins = pendingPins.current.get(userId) ?? new Map();
        pins.set(boardId, pinned);
        pendingPins.current.set(userId, pins);
        return;
      }

      const nextPinned = current.pinned.filter((id) => id !== boardId);
      if (pinned) nextPinned.push(boardId);
      const next = {
        ...current,
        pinned: nextPinned,
        boards: current.boards.map((board) =>
          boardKey(board) === boardId ? { ...board, pinned } : board
        ),
      };
      userBoardsRef.current = { ...userBoardsRef.current, [userId]: next };
      setUserBoardsByUser(userBoardsRef.current);
    },
    []
  );

  const upsertBoard = useCallback((userId: string, board: BoardRecord) => {
    const id = boardKey(board);
    if (!id) return;

    boardsRef.current = { ...boardsRef.current, [id]: board };
    setBoardsById(boardsRef.current);
    setMissingIds((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const current = userBoardsRef.current[userId];
    if (!current) {
      const pending = pendingBoards.current.get(userId) ?? [];
      pendingBoards.current.set(userId, [
        ...pending.filter((entry) => boardKey(entry) !== id),
        board,
      ]);
      return;
    }

    const exists = current.boards.some((entry) => boardKey(entry) === id);
    const boards = exists
      ? current.boards.map((entry) =>
          boardKey(entry) === id ? { ...entry, ...board } : entry
        )
      : [...current.boards, board];
    const next = { ...current, boards };
    userBoardsRef.current = { ...userBoardsRef.current, [userId]: next };
    setUserBoardsByUser(userBoardsRef.current);
  }, []);

  const patchBoard = useCallback((boardId: string, patch: object) => {
    const current = boardsRef.current[boardId];
    if (!current) return;
    boardsRef.current = {
      ...boardsRef.current,
      [boardId]: { ...current, ...patch },
    };
    setBoardsById(boardsRef.current);
  }, []);

  const invalidateBoard = useCallback((boardId: string) => {
    boardFetchGen.current.set(
      boardId,
      (boardFetchGen.current.get(boardId) ?? 0) + 1
    );
    boardInflight.current.delete(boardId);
    if (boardsRef.current[boardId]) {
      const next = { ...boardsRef.current };
      delete next[boardId];
      boardsRef.current = next;
      setBoardsById(next);
    }
    setMissingIds((prev) => {
      if (!prev[boardId]) return prev;
      const next = { ...prev };
      delete next[boardId];
      return next;
    });
  }, []);

  const invalidateUserBoards = useCallback((userId: string) => {
    userFetchGen.current.set(userId, (userFetchGen.current.get(userId) ?? 0) + 1);
    userInflight.current.delete(userId);
    pendingBoards.current.delete(userId);
    pendingPins.current.delete(userId);
    setListEpoch((prev) => ({ ...prev, [userId]: (prev[userId] ?? 0) + 1 }));
    if (!userBoardsRef.current[userId]) return;
    const next = { ...userBoardsRef.current };
    delete next[userId];
    userBoardsRef.current = next;
    setUserBoardsByUser(next);
  }, []);

  const value = useMemo(
    () => ({
      userBoardsByUser,
      boardsById,
      missingIds,
      listEpoch,
      ensureUserBoards,
      ensureBoardInfo,
      setPinned,
      upsertBoard,
      patchBoard,
      invalidateBoard,
      invalidateUserBoards,
    }),
    [
      userBoardsByUser,
      boardsById,
      missingIds,
      listEpoch,
      ensureUserBoards,
      ensureBoardInfo,
      setPinned,
      upsertBoard,
      patchBoard,
      invalidateBoard,
      invalidateUserBoards,
    ]
  );

  return (
    <BoardsContext.Provider value={value}>{children}</BoardsContext.Provider>
  );
}

function useBoardsContext() {
  const ctx = useContext(BoardsContext);
  if (!ctx) {
    throw new Error("useBoards must be used within BoardsProvider");
  }
  return ctx;
}

export function useUserBoards(userId?: string | null) {
  const { userBoardsByUser, listEpoch, ensureUserBoards } = useBoardsContext();
  const cached = userId ? userBoardsByUser[userId] : undefined;
  const epoch = userId ? listEpoch[userId] ?? 0 : 0;

  useEffect(() => {
    if (!userId || cached) return;
    void ensureUserBoards(userId);
  }, [userId, cached, epoch, ensureUserBoards]);

  return {
    boards: cached?.boards ?? EMPTY_BOARDS,
    pinned: cached?.pinned ?? EMPTY_PINNED,
    loading: Boolean(userId) && !cached,
  };
}

export function useBoardInfo(boardId?: string | null, userId?: string | null) {
  const { boardsById, missingIds, ensureBoardInfo } = useBoardsContext();
  const board = boardId ? boardsById[boardId] : undefined;
  const missing = Boolean(boardId && missingIds[boardId]);

  useEffect(() => {
    if (!boardId || !userId || board || missing) return;
    void ensureBoardInfo(boardId, userId);
  }, [boardId, userId, board, missing, ensureBoardInfo]);

  return {
    board: board ?? null,
    loading: Boolean(boardId && userId) && !board && !missing,
    missing,
  };
}

export type RecentBoard = {
  id: string;
  label: string;
  urlName: string;
  href: string;
};

export function useRecentBoards(userId?: string | null): RecentBoard[] {
  const { boards, loading } = useUserBoards(userId);
  const { boardsById, ensureBoardInfo } = useBoardsContext();
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getRecentBoards(userId).then((ids) => {
      if (!cancelled) setRecentIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const missingKey = recentIds
    .filter((id) => !boards.some((board) => boardKey(board) === id) && !boardsById[id])
    .join(",");

  useEffect(() => {
    if (!userId || loading || !missingKey) return;
    for (const id of missingKey.split(",")) {
      void ensureBoardInfo(id, userId);
    }
  }, [userId, loading, missingKey, ensureBoardInfo]);

  return recentIds.flatMap((id) => {
    const summary = boards.find((board) => boardKey(board) === id);
    const source = summary || boardsById[id];
    if (!source) return [];
    const urlName = source.urlName || source.name || "board";
    return [
      {
        id,
        label: source.name || "Untitled",
        urlName,
        href: `/b/${id}/${encodeURIComponent(urlName)}`,
      },
    ];
  });
}

export function useBoardCache() {
  const {
    setPinned,
    upsertBoard,
    patchBoard,
    invalidateBoard,
    invalidateUserBoards,
  } = useBoardsContext();
  return {
    setPinned,
    upsertBoard,
    patchBoard,
    invalidateBoard,
    invalidateUserBoards,
  };
}
