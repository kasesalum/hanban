"use client";

import {
  DEFAULT_BOARD_LABELS,
  type BoardLabel,
  type MemberProfile,
} from "@/components/boards/boardCard";
import CardDetailModal, {
  type DetailCard,
} from "@/components/boards/cardDetailModal";
import BoardWorkspace from "@/components/boards/boardWorkspace";
import TicketGroupList from "@/components/boards/ticketGroupList";
import type { TicketCardData } from "@/components/boards/ticketCard";
import HeaderActions from "@/components/navigation/headerActions";
import { auth } from "@/lib/firebase";
import {
  addCardComment,
  deleteBoardCard,
  getBoardArchive,
  moveBoardCard,
  updateBoardCard,
  type CardSlip,
} from "@/lib/helper";
import { groupCardsByCompletedMonth } from "@/lib/cardSort";
import { useBoardCache, useBoardInfo } from "@/lib/useBoards";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ArchiveCard = TicketCardData & {
  comments?: DetailCard["comments"];
  activity?: DetailCard["activity"];
};

type BoardList = {
  id: string;
  title: string;
  cards: ArchiveCard[];
};

type BoardInfo = {
  id: string;
  name?: string;
  privacy?: string;
  members?: string[];
  memberProfiles?: MemberProfile[];
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

export default function ArchivePage({
  boardId,
  boardName,
}: {
  boardId: string;
  boardName: string;
}) {
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
  const [cards, setCards] = useState<ArchiveCard[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const loading = !user || boardLoading || archiveLoading;

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
  } | null>(null);
  const openCardRef = useRef(openCard);
  openCardRef.current = openCard;
  const cachedBoardRef = useRef(cachedBoard);
  cachedBoardRef.current = cachedBoard;

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
    if (!user) return;
    let cancelled = false;
    setArchiveLoading(true);
    getBoardArchive(boardId).then((archive) => {
      if (cancelled) return;
      setCards(archive?.cards || []);
      if (archive?.labels?.length) {
        const labels = archive.labels;
        setOverride((prev) => {
          const current =
            prev?.boardId === boardId
              ? prev.board
              : ((cachedBoardRef.current as BoardInfo | null) ?? null);
          if (!current) return prev;
          return { boardId, board: { ...current, labels } };
        });
        patchBoard(boardId, { labels });
      }
      setArchiveLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, boardId, patchBoard]);

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
  const boardHref = `/b/${boardId}/${boardName}`;
  const months = groupCardsByCompletedMonth(cards);

  const applyCardResult = (result: { card: any; lists: any[] }) => {
    commitBoard({ lists: result.lists });
    setCards((prev) =>
      result.card?.archived
        ? prev.map((card) =>
            card.id === result.card.id ? { ...card, ...result.card } : card
          )
        : prev.filter((card) => card.id !== result.card.id)
    );
    if (!result.card?.archived) {
      setOpenCard(null);
      return;
    }
    setOpenCard((prev) =>
      prev && prev.card.id === result.card.id
        ? { card: result.card, listId: prev.listId }
        : prev
    );
  };

  const handleMove = async (cardId: string, listId: string) => {
    const result = await moveBoardCard(boardId, cardId, listId, user?.uid);
    if (result) applyCardResult(result);
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
    if (!current) return;
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
    if (!openCard) return;
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
    if (!cardId) return;
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, ...slip } : card))
    );
    setOpenCard((prev) =>
      prev && prev.card.id === cardId
        ? { ...prev, card: { ...prev.card, ...slip } }
        : prev
    );
  };

  const handleDeleteCard = async () => {
    if (!openCard) return;
    const result = await deleteBoardCard(boardId, openCard.card.id);
    if (!result) return;
    commitBoard({ lists: result.lists });
    setCards((prev) => prev.filter((card) => card.id !== openCard.card.id));
    setOpenCard(null);
  };

  return (
    <BoardWorkspace
      onSignOut={handleSignOut}
      userName={userName}
      user={user}
      title={title}
      background={board?.background}
      leading={
        <span className="shrink-0 text-xs uppercase tracking-wide px-2 py-1 rounded-md bg-black/40 text-gray-200">
          Archive
        </span>
      }
      actions={
        <HeaderActions
          overlay
          primary={
            <Link
              href={boardHref}
              className="inline-flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-black/40 border border-white/10 text-gray-200"
            >
              Back to board
            </Link>
          }
        />
      }
    >
      <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <p className="text-white/80">Loading archive…</p>
        ) : !board ? (
          <p className="text-white/80">Board not found.</p>
        ) : months.length === 0 ? (
          <p className="text-white/80">No archived cards yet.</p>
        ) : (
          <div className="mx-auto w-full max-w-xl flex flex-col gap-8">
            {months.map((group) => (
              <section
                key={group.key}
                className="rounded-xl bg-background/90 border border-border shadow-md p-3"
              >
                <TicketGroupList
                  heading={group.label}
                  cards={group.cards}
                  listId="done"
                  labels={boardLabels}
                  currentUserId={user?.uid}
                  memberProfiles={memberProfiles}
                  onOpen={(card) => setOpenCard({ card, listId: "done" })}
                  onMove={handleMove}
                />
              </section>
            ))}
          </div>
        )}
      </div>

      <CardDetailModal
        open={Boolean(openCard)}
        boardId={boardId}
        card={openCard?.card || null}
        listId={openCard?.listId || "done"}
        lists={lists}
        labels={boardLabels}
        members={members}
        currentUserId={user?.uid}
        memberProfiles={memberProfiles}
        onClose={() => setOpenCard(null)}
        onMove={(listId) => {
          if (openCard) handleMove(openCard.card.id, listId);
        }}
        onUpdate={handleUpdateCard}
        onComment={handleComment}
        onDelete={handleDeleteCard}
        onSlip={handleSlip}
      />
    </BoardWorkspace>
  );
}
