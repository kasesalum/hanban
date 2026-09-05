import { db } from "./firebase.js";

export const NOTIFICATION_TYPES = {
  assigneeAdded: "assignee_added",
  deadlineApproaching: "deadline_approaching",
  deadlineOverdue: "deadline_overdue",
  boardMemberAdded: "board_member_added",
};

export async function createInboxNotifications({
  type,
  userIds = [],
  boardId,
  boardName,
  urlName,
  card,
}) {
  const uids = [...new Set((userIds || []).filter(Boolean))];
  if (uids.length === 0) return;

  const createdAt = new Date();
  await Promise.all(
    uids.map((userId) =>
      db.collection("Notifications").add({
        userId,
        type,
        boardId,
        boardName: boardName || "Untitled board",
        urlName: urlName || "board",
        cardId: card?.id || "",
        cardTitle: card?.title || "Untitled",
        createdAt,
        read: false,
      })
    )
  );
}
