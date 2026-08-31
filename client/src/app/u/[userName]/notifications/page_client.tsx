"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/navigation/sidebar";
import {
  AlertTriangle,
  Bell,
  Clock,
  UserPlus,
} from "lucide-react";
import {
  AppNotification,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/helper";

interface NotificationsPageProps {
  userName: string;
}

function notificationCopy(item: AppNotification) {
  if (item.type === "assignee_added") {
    return {
      icon: UserPlus,
      title: `You were added to “${item.cardTitle}”`,
      detail: `On ${item.boardName}`,
    };
  }
  if (item.type === "deadline_approaching") {
    return {
      icon: Clock,
      title: `Deadline approaching: “${item.cardTitle}”`,
      detail: `On ${item.boardName}`,
    };
  }
  return {
    icon: AlertTriangle,
    title: `Deadline overdue: “${item.cardTitle}”`,
    detail: `On ${item.boardName}`,
  };
}

export default function NotificationsPage({
  userName,
}: NotificationsPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      const data = await getUserNotifications(user.uid);
      setNotifications(data.notifications);
      setLoading(false);
    }
    load();
  }, [user]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleOpen = async (item: AppNotification) => {
    if (!user) return;
    if (!item.read) {
      await markNotificationRead(item.id, user.uid);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
    }
    const boardName = encodeURIComponent(item.urlName || "board");
    router.push(`/b/${item.boardId}/${boardName}`);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    const ok = await markAllNotificationsRead(user.uid);
    if (ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background text-gray-100">
      <Sidebar
        onSignOut={handleSignOut}
        userName={userName}
        user={user}
        unreadCount={unreadCount}
      />

      <main className="flex-1 overflow-y-auto space-y-10">
        <header className="flex items-center justify-between px-8 py-4 border-b border-border w-full">
          <h1 className="flex items-center text-2xl font-semibold">
            <Bell className="inline-block w-6 h-6 mr-4" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-md border border-border hover:bg-border-hover"
            >
              Mark all as read
            </button>
          )}
        </header>

        <div className="px-8 pb-10">
          {loading ? (
            <p className="text-gray-400">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-gray-400">No notifications yet.</p>
          ) : (
            <ul className="space-y-3 max-w-3xl">
              {notifications.map((item) => {
                const copy = notificationCopy(item);
                const Icon = copy.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleOpen(item)}
                      className={`w-full text-left rounded-xl border border-border p-4 transition hover:bg-border-hover ${
                        item.read ? "bg-background" : "bg-background-alt"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="relative mt-0.5">
                          <Icon className="w-5 h-5 text-gray-300" />
                          {!item.read && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate ${
                              item.read
                                ? "font-medium text-gray-200"
                                : "font-semibold text-white"
                            }`}
                          >
                            {copy.title}
                          </p>
                          <p className="text-sm text-gray-400 truncate">
                            {copy.detail}
                          </p>
                          {item.createdAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
