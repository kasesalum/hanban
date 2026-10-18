"use client";

import BoardCard, {
  cardLabelIds,
  type BoardLabel,
  type MemberProfile,
} from "@/components/boards/boardCard";
import type { DragEvent } from "react";

export type TicketCardData = {
  id: string;
  title: string;
  description?: string;
  assignees?: string[];
  labels?: string[];
  label?: string;
  deadline?: string;
  postponedDays?: number;
  createdAt?: string;
  completedAt?: string;
  archived?: boolean;
};

export default function TicketCard({
  card,
  listId,
  labels,
  currentUserId,
  memberProfiles,
  draggable,
  onDragStart,
  onOpen,
  onMove,
}: {
  card: TicketCardData;
  listId: string;
  labels: BoardLabel[];
  currentUserId?: string;
  memberProfiles: MemberProfile[];
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onOpen: () => void;
  onMove?: (listId: string) => void;
}) {
  const inner = (
    <BoardCard
      compact
      currentUserId={currentUserId}
      memberProfiles={memberProfiles}
      listId={listId}
      onMove={onMove}
      onOpen={onOpen}
      labels={labels}
      board={{
        id: card.id,
        name: card.title,
        description: card.description,
        assignees: card.assignees,
        labelIds: cardLabelIds(card),
        deadline: card.deadline,
        postponedDays: card.postponedDays,
      }}
    />
  );

  if (!draggable) return inner;

  return (
    <div draggable onDragStart={onDragStart}>
      {inner}
    </div>
  );
}
