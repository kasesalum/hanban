"use client";

import BoardCard, {
  DEFAULT_BOARD_LABELS,
  type BoardLabel,
  type MemberProfile,
} from "@/components/boards/boardCard";
import CardDetailModal, {
  type DetailCard,
} from "@/components/boards/cardDetailModal";
import { tomorrowISO } from "@/components/boards/deadlinePicker";
import LabelsEditorModal from "@/components/boards/labelsEditorModal";
import MembersModal from "@/components/boards/membersModal";
import {
  BoardFilterMenu,
  BoardSettingsMenu,
} from "@/components/boards/boardHeaderMenus";
import AppShell from "@/components/navigation/appShell";
import HeaderActions from "@/components/navigation/headerActions";
import PageHeader from "@/components/navigation/pageHeader";
import { auth } from "@/lib/firebase";
import {
  addBoardMember,
  addCardComment,
  createBoardCard,
  deleteBoardCard,
  FEATURE_BOARD_ID,
  getBoardInfo,
  moveBoardCard,
  removeBoardMember,
  updateBoardCard,
  updateBoardLabels,
} from "@/lib/helper";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { DragEvent, useEffect, useState } from "react";

interface BoardPageProps {
  boardId: string;
  boardName: string;
}

type TaskCard = {
  id: string;
  title: string;
  description?: string;
  assignees?: string[];
  label?: string;
  deadline?: string;
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
    label: "",
    deadline: tomorrowISO(),
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
  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const fetchBoard = async () => {
      if (!user) return;
      setLoading(true);
      const info = await getBoardInfo(boardId, user.uid);
      setBoard(info);
      setLoading(false);
    };

    fetchBoard();
  }, [user, boardId]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const lists = board?.lists?.length ? board.lists : EMPTY_COLUMNS;
  const boardLabels = board?.labels?.length ? board.labels : DEFAULT_BOARD_LABELS;
  const members = board?.members || [];
  const memberProfiles = board?.memberProfiles || [];
  const userName = user?.displayName?.replace(/\s+/g, "") || "unknown";
  const title = board?.name || decodeURIComponent(boardName) || "Untitled Board";

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
    if (labelFilter && card.label !== labelFilter) return false;
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
    setBoard((prev) => (prev ? { ...prev, lists: result.lists } : prev));
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
    assignees?: string[];
    label?: string;
    deadline?: string;
  }) => {
    if (!openCard || openCard.isNew) return;
    const result = await updateBoardCard(boardId, openCard.card.id, {
      ...fields,
      actorId: user?.uid,
    });
    if (result) applyCardResult(result);
  };

  const handleComment = async (text: string) => {
    if (!openCard || openCard.isNew) return;
    const result = await addCardComment(
      boardId,
      openCard.card.id,
      text,
      user?.uid
    );
    if (result) applyCardResult(result);
  };

  const handleDeleteCard = async () => {
    if (!openCard || openCard.isNew) return;
    const result = await deleteBoardCard(boardId, openCard.card.id);
    if (!result) return;
    setBoard((prev) => (prev ? { ...prev, lists: result.lists } : prev));
    setOpenCard(null);
  };

  const handleCreateCard = async (fields: {
    title: string;
    description?: string;
    assignees?: string[];
    label?: string;
    deadline?: string;
  }) => {
    if (!openCard?.isNew) return false;
    const result = await createBoardCard(boardId, openCard.listId, fields);
    if (!result) return false;

    setBoard((prev) =>
      prev ? { ...prev, lists: result.lists } : { id: boardId, lists: result.lists }
    );
    setOpenCard({
      card: result.card,
      listId: openCard.listId,
      isNew: false,
    });
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

  return (
    <AppShell
      onSignOut={handleSignOut}
      userName={userName}
      user={user}
      mainClassName="relative flex-1 min-w-0 flex flex-col overflow-hidden"
    >
      {board?.background?.type === "color" ? (
          <div
            className="absolute inset-0"
            style={{ background: board.background.value }}
          />
        ) : board?.background?.value ? (
          <img
            src={board.background.value}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-background" />
        )}
        <div className="absolute inset-0 bg-black/25" />

        <PageHeader
          variant="overlay"
          title={title}
          leading={
            board?.privacy ? (
              <span className="shrink-0 text-xs uppercase tracking-wide px-2 py-1 rounded-md bg-black/40 text-gray-200">
                {board.privacy}
              </span>
            ) : undefined
          }
          actions={
            <HeaderActions
              overlay
              primary={
                <>
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
                    onEditLabels={() => setLabelsOpen(true)}
                    onEditMembers={() => setMembersOpen(true)}
                  />
                </>
              }
            />
          }
        />

        <div className="relative z-10 flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-6">
          {loading ? (
            <p className="text-white/80">Loading board…</p>
          ) : !board ? (
            <p className="text-white/80">Board not found.</p>
          ) : (
            <div className="flex gap-4 h-full items-start">
              {lists.map((column) => {
                const visibleCards = (column.cards || []).filter(matchesFilters);
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
                    <h2 className="px-4 py-3 font-semibold text-gray-100">
                      {column.title}
                    </h2>
                    <div className="px-3 pb-3 flex flex-col gap-3 overflow-y-auto">
                      {visibleCards.length === 0 && (
                        <p className="px-1 text-sm text-gray-400">
                          No cards yet
                        </p>
                      )}
                      {visibleCards.map((card) => (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(event) => handleDragStart(event, card.id)}
                        >
                          <BoardCard
                            compact
                            currentUserId={user?.uid}
                            memberProfiles={memberProfiles}
                            listId={column.id}
                            onMove={(nextListId) =>
                              handleMove(card.id, nextListId)
                            }
                            onOpen={() =>
                              setOpenCard({ card, listId: column.id })
                            }
                            labels={boardLabels}
                            board={{
                              id: card.id,
                              name: card.title,
                              description: card.description,
                              assignees: card.assignees,
                              label: card.label,
                              deadline: card.deadline,
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenCard((prev) =>
                          prev?.isNew
                            ? { ...prev, listId: column.id }
                            : {
                                card: newDraftCard(),
                                listId: column.id,
                                isNew: true,
                              }
                        );
                      }}
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
      />
      <LabelsEditorModal
        open={labelsOpen}
        labels={boardLabels}
        onClose={() => setLabelsOpen(false)}
        onSave={async (next) => {
          const result = await updateBoardLabels(boardId, next);
          if (!result) return;
          setBoard((prev) =>
            prev
              ? { ...prev, labels: result.labels, lists: result.lists }
              : prev
          );
          setLabelsOpen(false);
        }}
      />
      <MembersModal
        open={membersOpen}
        members={members}
        ownerId={board?.ownerId}
        currentUserId={user?.uid}
        memberProfiles={memberProfiles}
        lockRemoval={
          boardId === FEATURE_BOARD_ID || board?.kind === "feature-requests"
        }
        onClose={() => setMembersOpen(false)}
        onAdd={async (email) => {
          const result = await addBoardMember(boardId, email, user?.uid);
          if (!result) return "Failed to add member";
          if ("error" in result) return result.error;
          setBoard((prev) =>
            prev
              ? {
                  ...prev,
                  members: result.members,
                  memberProfiles: result.memberProfiles || prev.memberProfiles,
                }
              : prev
          );
          return null;
        }}
        onRemove={async (uid) => {
          const result = await removeBoardMember(boardId, uid);
          if (!result) return "Failed to remove member";
          if ("error" in result) return result.error;
          setBoard((prev) =>
            prev
              ? {
                  ...prev,
                  members: result.members,
                  memberProfiles: result.memberProfiles || prev.memberProfiles,
                  lists: result.lists || prev.lists,
                }
              : prev
          );
          return null;
        }}
      />
    </AppShell>
  );
}
