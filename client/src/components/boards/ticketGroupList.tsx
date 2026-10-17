"use client";

import TicketCard, {
  type TicketCardData,
} from "@/components/boards/ticketCard";
import type { BoardLabel, MemberProfile } from "@/components/boards/boardCard";
import type { ReactNode } from "react";

export default function TicketGroupList({
  heading,
  cards,
  empty,
  listId,
  labels,
  currentUserId,
  memberProfiles,
  draggable,
  onOpen,
  onMove,
  onDragStart,
}: {
  heading?: string;
  cards: TicketCardData[];
  empty?: ReactNode;
  listId: string;
  labels: BoardLabel[];
  currentUserId?: string;
  memberProfiles: MemberProfile[];
  draggable?: boolean;
  onOpen: (card: TicketCardData) => void;
  onMove?: (cardId: string, listId: string) => void;
  onDragStart?: (cardId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {heading ? (
        <h2 className="font-semibold text-gray-100 truncate min-w-0">
          {heading}
        </h2>
      ) : null}
      {cards.length === 0 && empty}
      {cards.map((card) => (
        <TicketCard
          key={card.id}
          card={card}
          listId={listId}
          labels={labels}
          currentUserId={currentUserId}
          memberProfiles={memberProfiles}
          draggable={draggable}
          onDragStart={
            onDragStart
              ? (event) => {
                  event.dataTransfer.setData("text/plain", card.id);
                  event.dataTransfer.effectAllowed = "move";
                  onDragStart(card.id);
                }
              : undefined
          }
          onOpen={() => onOpen(card)}
          onMove={
            onMove ? (nextListId) => onMove(card.id, nextListId) : undefined
          }
        />
      ))}
    </div>
  );
}
