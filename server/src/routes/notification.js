import express from "express";
import { db } from "../firebase.js";

const router = express.Router();

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
