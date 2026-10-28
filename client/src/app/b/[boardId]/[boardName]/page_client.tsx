"use client";

import {
  DEFAULT_BOARD_LABELS,
  cardLabelIds,
  type BoardLabel,
  type MemberProfile,
} from "@/components/boards/boardCard";
import CardDetailModal, {
  type DetailCard,
} from "@/components/boards/cardDetailModal";
import LabelsEditorModal from "@/components/boards/labelsEditorModal";
import MembersModal from "@/components/boards/membersModal";
import BoardInfoTip from "@/components/boards/boardInfoTip";
import BoardInfoModal from "@/components/boards/boardInfoModal";
import {
  BoardFilterMenu,
  BoardSettingsMenu,
} from "@/components/boards/boardHeaderMenus";
import BoardWorkspace from "@/components/boards/boardWorkspace";
import TicketCard, {
  type TicketCardData,
} from "@/components/boards/ticketCard";
import HeaderActions from "@/components/navigation/headerActions";
import { auth } from "@/lib/firebase";
import {
  addBoardMember,
  addCardComment,
  createBoardCard,
  deleteBoardCard,
  FEATURE_BOARD_ID,
  FEATURE_BOARD_INFO,
  moveBoardCard,
  removeBoardMember,
  setBlockedColumnVisible,
  updateBoardCard,
  updateBoardInfo,
  updateBoardLabels,
  type CardSlip,
} from "@/lib/helper";
import {
  SORT_OPTIONS,
  type SortKey,
  defaultSortForList,
  isDoneVisible,
  sortCards,
} from "@/lib/cardSort";
import { useBoardCache, useBoardInfo } from "@/lib/useBoards";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { ArrowUpDown, Plus } from "lucide-react";
import Loading from "@/components/loading";
import { useRouter } from "next/navigation";
import { DragEvent, useEffect, useRef, useState } from "react";

interface BoardPageProps {
  boardId: string;
  boardName: string;
}

type TaskCard = TicketCardData & {
  comments?: DetailCard["comments"];
  activity?: DetailCard["activity"];
};

type BoardList = {
  id: string;
  title: string;
  cards: TaskCard[];
};

type BoardInfo = {
  id: string;
  name?: string;
  urlName?: string;
  privacy?: string;
  members?: string[];
  memberProfiles?: MemberProfile[];
  ownerId?: string;
  kind?: string;
  info?: string;
  lists?: BoardList[];
  labels?: BoardLabel[];
  background?: {
    type: "color" | "preset" | "upload";
    value: string;
  };
};

const EMPTY_COLUMNS: BoardList[] = [
  { id: "todo", title: "To Do", cards: [] },
  { id: "blocked", title: "Blocked", cards: [] },
  { id: "in-progress", title: "In Progress", cards: [] },
  { id: "done", title: "Done", cards: [] },
];

function newDraftCard(): DetailCard {
  return {
    id: `__new__-${crypto.randomUUID()}`,
    title: "",
    description: "",
    assignees: [],
    labels: [],
    deadline: "",
    comments: [],
    activity: [],
  };
}

function applyMove(
  lists: BoardList[],
  cardId: string,
  listId: string
): BoardList[] {
  let moved: TaskCard | null = null;
  const next = lists.map((list) => ({
    ...list,
    cards: (list.cards || []).filter((card) => {
      if (card.id === cardId) {
        moved = card;
        return false;
      }
      return true;
    }),
  }));

  if (!moved) return lists;
  return next.map((list) =>
    list.id === listId
      ? { ...list, cards: [...list.cards, moved as TaskCard] }
      : list
  );
}

export default function BoardPage({ boardId, boardName }: BoardPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const { board: cachedBoard, loading: boardLoading } = useBoardInfo(
    boardId,
    user?.uid
  );
  const { patchBoard } = useBoardCache();
  const [override, setOverride] = useState<{
    boardId: string;
    board: BoardInfo | null;
  } | null>(null);
  const board =
    override?.boardId === boardId
      ? override.board
      : ((cachedBoard as BoardInfo | null) ?? null);
  const loading = !user || boardLoading;

  const setBoard = (
    updater: BoardInfo | null | ((prev: BoardInfo | null) => BoardInfo | null)
  ) => {
    setOverride((prev) => {
      const current =
        prev?.boardId === boardId
          ? prev.board
          : ((cachedBoard as BoardInfo | null) ?? null);
      const next = typeof updater === "function" ? updater(current) : updater;
      return { boardId, board: next };
    });
  };

  const commitBoard = (patch: Partial<BoardInfo>) => {
    setBoard((prev) => (prev ? { ...prev, ...patch } : prev));
    patchBoard(boardId, patch);
  };
  const [openCard, setOpenCard] = useState<{
    card: DetailCard;
    listId: string;
    isNew?: boolean;
  } | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [dragOverList, setDragOverList] = useState<string | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [columnSort, setColumnSort] = useState<Record<string, SortKey>>({});
  const [confirmRemoveBlocked, setConfirmRemoveBlocked] = useState(false);
  const [blockedSaving, setBlockedSaving] = useState(false);
  const openCardRef = useRef(openCard);
  openCardRef.current = openCard;
  const boardRef = useRef(board);
  boardRef.current = board;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const lists = board?.lists?.length ? board.lists : EMPTY_COLUMNS;
  const blockedList = board?.lists?.find((list) => list.id === "blocked");
  const boardLabels = board?.labels?.length ? board.labels : DEFAULT_BOARD_LABELS;
  const members = board?.members || [];
  const memberProfiles = board?.memberProfiles || [];
  const userName = user?.displayName?.replace(/\s+/g, "") || "unknown";
  const title = board?.name || decodeURIComponent(boardName) || "Untitled Board";
  const isFeatureBoard =
    boardId === FEATURE_BOARD_ID || board?.kind === "feature-requests";
  const boardInfoText = isFeatureBoard
    ? board?.info?.trim() || FEATURE_BOARD_INFO
    : board?.info || "";
  const archiveHref = `/b/${boardId}/${boardName}/archive`;

  const matchesFilters = (card: TaskCard) => {
    if (assigneeFilter === "me" && user?.uid && !card.assignees?.includes(user.uid)) {
      return false;
    }
    if (
      assigneeFilter &&
      assigneeFilter !== "me" &&
      !card.assignees?.includes(assigneeFilter)
    ) {
      return false;
    }
    if (labelFilter && !cardLabelIds(card).includes(labelFilter)) return false;
    return true;
  };

  const handleMove = async (cardId: string, listId: string) => {
    const previous = lists;
    const alreadyThere = previous.some(
      (list) => list.id === listId && list.cards.some((card) => card.id === cardId)
    );
    if (alreadyThere) return;

    const next = applyMove(previous, cardId, listId);
    setBoard((prev) => (prev ? { ...prev, lists: next } : prev));
    if (openCard?.card.id === cardId) {
      setOpenCard((prev) => (prev ? { ...prev, listId } : prev));
    }

    const result = await moveBoardCard(boardId, cardId, listId, user?.uid);
    if (!result) {
      setBoard((prev) => (prev ? { ...prev, lists: previous } : prev));
      return;
    }
    applyCardResult(result);
  };

  const applyCardResult = (result: { card: any; lists: any[] }) => {
    commitBoard({ lists: result.lists });
    const nextListId = result.lists.find((list: BoardList) =>
      (list.cards || []).some((item) => item.id === result.card.id)
    )?.id;
    setOpenCard((prev) =>
      prev && prev.card.id === result.card.id
        ? { card: result.card, listId: nextListId || prev.listId }
        : prev
    );
  };

  const handleUpdateCard = async (fields: {
    title?: string;
    description?: string;
    descriptionAttachments?: { url: string; path: string }[];
    assignees?: string[];
    labels?: string[];
    deadline?: string;
  }) => {
    const current = openCardRef.current;
    if (!current || current.isNew) return;
    const result = await updateBoardCard(boardId, current.card.id, {
      ...fields,
      actorId: user?.uid,
    });
    if (result) applyCardResult(result);
  };

  const handleComment = async (
    html: string,
    attachments: { url: string; path: string }[]
  ) => {
    if (!openCard || openCard.isNew) return;
    await addCardComment(
      boardId,
      openCard.card.id,
      html,
      user?.uid,
      attachments
    );
  };

  const handleSlip = (slip: CardSlip) => {
    const cardId = openCardRef.current?.card.id;
    if (!cardId || openCardRef.current?.isNew) return;
    const current = boardRef.current;
    if (!current?.lists) return;
    const lists = current.lists.map((list) => ({
      ...list,
      cards: list.cards.map((card) =>
        card.id === cardId ? { ...card, ...slip } : card
      ),
    }));
    setBoard((prev) => (prev ? { ...prev, lists } : prev));
    patchBoard(boardId, { lists });
    setOpenCard((prev) =>
      prev && prev.card.id === cardId
        ? { ...prev, card: { ...prev.card, ...slip } }
        : prev
    );
  };

  const handleDeleteCard = async () => {
    if (!openCard || openCard.isNew) return;
    const result = await deleteBoardCard(boardId, openCard.card.id);
    if (!result) return;
    commitBoard({ lists: result.lists });
    setOpenCard(null);
  };

  const handleCreateCard = async (fields: {
    title: string;
    description?: string;
    assignees?: string[];
    labels?: string[];
    deadline?: string;
  }) => {
    if (!openCard?.isNew) return false;
    const result = await createBoardCard(boardId, openCard.listId, {
      ...fields,
      actorId: user?.uid,
    });
    if (!result) return false;

    const nextOpen = {
      card: result.card,
      listId: openCard.listId,
      isNew: false,
    };
    openCardRef.current = nextOpen;
    setBoard((prev) =>
      prev ? { ...prev, lists: result.lists } : { id: boardId, lists: result.lists }
    );
    patchBoard(boardId, { lists: result.lists });
    setOpenCard(nextOpen);
    return true;
  };

  const handleDragStart = (event: DragEvent, cardId: string) => {
    event.dataTransfer.setData("text/plain", cardId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (event: DragEvent, listId: string) => {
    event.preventDefault();
    setDragOverList(null);
    const cardId = event.dataTransfer.getData("text/plain");
    if (cardId) handleMove(cardId, listId);
  };

  const openDraft = (listId: string) => {
    setOpenCard((prev) =>
      prev?.isNew
        ? { ...prev, listId }
        : {
            card: newDraftCard(),
            listId,
            isNew: true,
          }
    );
  };

  const handleSetBlocked = async (visible: boolean) => {
    if (blockedSaving) return null;
    setBlockedSaving(true);
    try {
      const result = await setBlockedColumnVisible(boardId, visible);
      if (!result) return "Failed to update the Blocked column";
      if ("error" in result) return result.error;
      commitBoard({ lists: result.lists });
      if (!visible) {
        setConfirmRemoveBlocked(false);
        setOpenCard((prev) =>
          prev?.listId === "blocked" ? { ...prev, listId: "todo" } : prev
        );
      }
      return null;
    } finally {
      setBlockedSaving(false);
    }
  };

  return (
    <BoardWorkspace
      onSignOut={handleSignOut}
      userName={userName}
      user={user}
      title={title}
      background={board?.background}
      leading={
        <>
          {boardInfoText.trim() ? (
            <BoardInfoTip info={boardInfoText} />
          ) : null}
          {board?.privacy ? (
            <span className="shrink-0 text-xs uppercase tracking-wide px-2 py-1 rounded-md bg-black/40 text-gray-200">
              {board.privacy}
            </span>
          ) : null}
        </>
      }
      actions={
        <HeaderActions
          overlay
          primary={
            <>
              {board && (
                <button
                  type="button"
                  title="Add a ticket"
                  onClick={() => openDraft("todo")}
                  className="inline-flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-black/40 border border-white/10 text-gray-200"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add a ticket</span>
                </button>
              )}
              <BoardFilterMenu
                assigneeFilter={assigneeFilter}
                labelFilter={labelFilter}
                labels={boardLabels}
                members={members}
                currentUserId={user?.uid}
                memberProfiles={memberProfiles}
                onAssigneeChange={setAssigneeFilter}
                onLabelChange={setLabelFilter}
              />
              <BoardSettingsMenu
                archiveHref={archiveHref}
                blockedVisible={Boolean(blockedList)}
                blockedCardCount={blockedList?.cards?.length || 0}
                onToggleBlocked={board ? handleSetBlocked : undefined}
                onEditLabels={() => setLabelsOpen(true)}
                onEditMembers={() => setMembersOpen(true)}
                onEditInfo={
                  isFeatureBoard ? undefined : () => setInfoOpen(true)
                }
              />
            </>
          }
        />
      }
    >
      <div className="relative z-10 flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-6">
        {loading ? (
          <Loading layout="page" label="Loading board" className="text-white/80" />
        ) : !board ? (
          <p className="text-white/80">Board not found.</p>
        ) : (
          <div className="flex gap-4 h-full items-start">
            {lists.map((column) => {
              const sortKey = columnSort[column.id] || defaultSortForList(column.id);
              const visibleCards = sortCards(
                (column.cards || []).filter((card) => {
                  if (column.id === "done" && !isDoneVisible(card)) return false;
                  return matchesFilters(card);
                }),
                sortKey
              );
              return (
                <section
                  key={column.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverList(column.id);
                  }}
                  onDragLeave={() =>
                    setDragOverList((prev) => (prev === column.id ? null : prev))
                  }
                  onDrop={(event) => handleDrop(event, column.id)}
                  className={`w-80 shrink-0 rounded-xl bg-background/90 border shadow-md flex flex-col max-h-full ${
                    dragOverList === column.id
                      ? "border-indigo-400"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-3">
                    <h2 className="font-semibold text-gray-100 truncate min-w-0">
                      {column.title}
                    </h2>
                    <label className="relative shrink-0 flex items-center text-gray-400">
                      <ArrowUpDown className="w-3.5 h-3.5 pointer-events-none absolute left-1.5" />
                      <select
                        value={sortKey}
                        aria-label={`Sort ${column.title}`}
                        title="Sort list"
                        onChange={(event) =>
                          setColumnSort((prev) => ({
                            ...prev,
                            [column.id]: event.target.value as SortKey,
                          }))
                        }
                        className="appearance-none pl-6 pr-1.5 py-1 w-[10.5rem] text-[11px] rounded-md bg-background-alt border border-border text-gray-300"
                      >
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {column.id === "blocked" && (
                    <button
                      type="button"
                      disabled={blockedSaving}
                      onClick={() => {
                        const count = (column.cards || []).length;
                        if (count > 0 && !confirmRemoveBlocked) {
                          setConfirmRemoveBlocked(true);
                          return;
                        }
                        void handleSetBlocked(false);
                      }}
                      className="mx-3 mb-2 px-2 py-1 rounded-md border border-white/15 text-left text-xs text-gray-200 hover:bg-border-hover disabled:opacity-50"
                    >
                      {confirmRemoveBlocked
                        ? "Move cards to To Do and remove"
                        : "Remove Blocked column"}
                    </button>
                  )}
                  <div className="px-3 pb-3 flex flex-col gap-3 overflow-y-auto">
                    {visibleCards.length === 0 && (
                      <p className="px-1 text-sm text-gray-400">
                        No cards yet
                      </p>
                    )}
                    {visibleCards.map((card) => (
                      <TicketCard
                        key={card.id}
                        card={card}
                        listId={column.id}
                        labels={boardLabels}
                        currentUserId={user?.uid}
                        memberProfiles={memberProfiles}
                        draggable
                        onDragStart={(event) => handleDragStart(event, card.id)}
                        onMove={(nextListId) => handleMove(card.id, nextListId)}
                        onOpen={() =>
                          setOpenCard({ card, listId: column.id })
                        }
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => openDraft(column.id)}
                    className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-border-hover transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add a card
                  </button>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <CardDetailModal
        open={Boolean(openCard)}
        boardId={boardId}
        card={openCard?.card || null}
        listId={openCard?.listId || ""}
        lists={lists}
        labels={boardLabels}
        members={members}
        currentUserId={user?.uid}
        memberProfiles={memberProfiles}
        isNew={Boolean(openCard?.isNew)}
        onClose={() => setOpenCard(null)}
        onMove={(listId) => {
          if (openCard?.isNew) {
            setOpenCard((prev) => (prev ? { ...prev, listId } : prev));
            return;
          }
          if (openCard) handleMove(openCard.card.id, listId);
        }}
        onUpdate={handleUpdateCard}
        onCreate={handleCreateCard}
        onComment={handleComment}
        onDelete={handleDeleteCard}
        onSlip={handleSlip}
      />
      <BoardInfoModal
        open={infoOpen}
        info={board?.info || ""}
        onClose={() => setInfoOpen(false)}
        onSave={async (next) => {
          const result = await updateBoardInfo(boardId, next);
          if (!result) return "Failed to update board info";
          if ("error" in result) return result.error;
          commitBoard({ info: result.info });
          return null;
        }}
      />
      <LabelsEditorModal
        open={labelsOpen}
        labels={boardLabels}
        onClose={() => setLabelsOpen(false)}
        onSave={async (next) => {
          const result = await updateBoardLabels(boardId, next);
          if (!result) return;
          commitBoard({ labels: result.labels, lists: result.lists });
          setLabelsOpen(false);
        }}
      />
      <MembersModal
        open={membersOpen}
        members={members}
        ownerId={board?.ownerId}
        currentUserId={user?.uid}
        memberProfiles={memberProfiles}
        lockRemoval={isFeatureBoard}
        onClose={() => setMembersOpen(false)}
        onAdd={async (email) => {
          const result = await addBoardMember(boardId, email, user?.uid);
          if (!result) return "Failed to add member";
          if ("error" in result) return result.error;
          commitBoard({
            members: result.members,
            memberProfiles: result.memberProfiles || board?.memberProfiles,
          });
          return null;
        }}
        onRemove={async (uid) => {
          const result = await removeBoardMember(boardId, uid);
          if (!result) return "Failed to remove member";
          if ("error" in result) return result.error;
          commitBoard({
            members: result.members,
            memberProfiles: result.memberProfiles || board?.memberProfiles,
            lists: result.lists || board?.lists,
          });
          return null;
        }}
      />
    </BoardWorkspace>
  );
}
