import { db } from "./firebase.js";

export const NOTIFICATION_TYPES = {
  assigneeAdded: "assignee_added",
  deadlineApproaching: "deadline_approaching",
  deadlineOverdue: "deadline_overdue",
  boardMemberAdded: "board_member_added",
  commentAdded: "comment_added",
  deadlineChanged: "deadline_changed",
  cardCompleted: "card_completed",
};

export const EMAIL_PREF_KEYS = [
  NOTIFICATION_TYPES.assigneeAdded,
  NOTIFICATION_TYPES.boardMemberAdded,
  NOTIFICATION_TYPES.deadlineApproaching,
  NOTIFICATION_TYPES.deadlineOverdue,
  NOTIFICATION_TYPES.commentAdded,
  NOTIFICATION_TYPES.deadlineChanged,
  NOTIFICATION_TYPES.cardCompleted,
];

export const DEFAULT_NOTIFICATION_PREFS = {
  emailEnabled: true,
  email: Object.fromEntries(EMAIL_PREF_KEYS.map((key) => [key, true])),
};

export function mergeNotificationPrefs(stored) {
  const email = { ...DEFAULT_NOTIFICATION_PREFS.email };
  const incoming = stored?.email && typeof stored.email === "object" ? stored.email : {};
  for (const key of EMAIL_PREF_KEYS) {
    if (typeof incoming[key] === "boolean") {
      email[key] = incoming[key];
    }
  }
  return {
    emailEnabled: stored?.emailEnabled !== false,
    email,
  };
}

export function shouldSendEmail(prefs, type) {
  const merged = mergeNotificationPrefs(prefs);
  if (!merged.emailEnabled) return false;
  return merged.email[type] !== false;
}

export async function loadPrefsForUids(uids = []) {
  const unique = [...new Set((uids || []).filter(Boolean))];
  const map = new Map();
  if (unique.length === 0) return map;

  const snaps = await Promise.all(
    unique.map((uid) => db.collection("Users").doc(uid).get())
  );
  snaps.forEach((snap, index) => {
    const data = snap.exists ? snap.data() : {};
    map.set(unique[index], mergeNotificationPrefs(data.notificationPrefs));
  });
  return map;
}

export async function createInboxNotifications({
  type,
  userIds = [],
  boardId,
  boardName,
  urlName,
  card,
  extra,
}) {
  const uids = [...new Set((userIds || []).filter(Boolean))];
  if (uids.length === 0) return;

  const createdAt = new Date();
  await Promise.all(
    uids.map((userId) => {
      const doc = {
        userId,
        type,
        boardId,
        boardName: boardName || "Untitled board",
        urlName: urlName || "board",
        cardId: card?.id || "",
        cardTitle: card?.title || "Untitled",
        createdAt,
        read: false,
      };
      if (extra?.commentPreview) {
        doc.commentPreview = String(extra.commentPreview).slice(0, 140);
      }
      return db.collection("Notifications").add(doc);
    })
  );
}
