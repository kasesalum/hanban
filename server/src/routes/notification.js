import express from "express";
import { db } from "../firebase.js";
import {
  EMAIL_PREF_KEYS,
  mergeNotificationPrefs,
} from "../notifications.js";

const router = express.Router();

// GET /api/user/notification-prefs?userId=
router.get("/notification-prefs", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const snap = await db.collection("Users").doc(userId).get();
    const stored = snap.exists ? snap.data().notificationPrefs : undefined;
    res.json({ notificationPrefs: mergeNotificationPrefs(stored) });
  } catch (error) {
    console.error("Error fetching notification prefs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/user/notification-prefs
router.patch("/notification-prefs", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    const incoming = req.body?.notificationPrefs;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }
    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ error: "Missing notificationPrefs" });
    }

    const userRef = db.collection("Users").doc(userId);
    const snap = await userRef.get();
    const current = mergeNotificationPrefs(
      snap.exists ? snap.data().notificationPrefs : undefined
    );
    const nextEmail = { ...current.email };
    if (incoming.email && typeof incoming.email === "object") {
      for (const key of EMAIL_PREF_KEYS) {
        if (typeof incoming.email[key] === "boolean") {
          nextEmail[key] = incoming.email[key];
        }
      }
    }
    const next = mergeNotificationPrefs({
      emailEnabled:
        typeof incoming.emailEnabled === "boolean"
          ? incoming.emailEnabled
          : current.emailEnabled,
      email: nextEmail,
    });

    await userRef.set({ notificationPrefs: next }, { merge: true });
    res.json({ notificationPrefs: next });
  } catch (error) {
    console.error("Error updating notification prefs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

function serializeNotification(doc) {
  const data = doc.data();
  const createdAt = data.createdAt?.toDate
    ? data.createdAt.toDate().toISOString()
    : data.createdAt;
  return { id: doc.id, ...data, createdAt };
}

// GET /api/user/notifications?userId=
router.get("/notifications", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const snap = await db
      .collection("Notifications")
      .where("userId", "==", userId)
      .get();

    const notifications = snap.docs
      .map(serializeNotification)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unreadCount = notifications.filter((item) => !item.read).length;

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/user/notifications/read-all
router.patch("/notifications/read-all", async (req, res) => {
  try {
    const userId = req.body?.userId || req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const snap = await db
      .collection("Notifications")
      .where("userId", "==", userId)
      .get();

    const unreadDocs = snap.docs.filter((doc) => !doc.data().read);

    if (unreadDocs.length > 0) {
      const batch = db.batch();
      unreadDocs.forEach((doc) => batch.update(doc.ref, { read: true }));
      await batch.commit();
    }

    res.json({ updated: unreadDocs.length });
  } catch (error) {
    console.error("Error marking notifications read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/user/notifications/:id
router.patch("/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body?.userId;
    const ref = db.collection("Notifications").doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (userId && snap.data().userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await ref.update({ read: true });
    res.json({ id, read: true });
  } catch (error) {
    console.error("Error marking notification read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
