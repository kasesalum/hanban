"use client";

import type { AppNotification } from "@/lib/helper";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  UserPlus,
} from "lucide-react";

function notificationCopy(item: AppNotification) {
  if (item.type === "board_member_added") {
    return {
      icon: UserPlus,
      title: `You were added to “${item.boardName}”`,
      detail: "You now have access to this board",
    };
  }
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
  if (item.type === "deadline_overdue") {
    return {
      icon: AlertTriangle,
      title: `Deadline overdue: “${item.cardTitle}”`,
      detail: `On ${item.boardName}`,
    };
  }
  if (item.type === "comment_added") {
    return {
      icon: MessageSquare,
      title: `New comment on “${item.cardTitle}”`,
      detail: item.commentPreview || `On ${item.boardName}`,
    };
  }
  if (item.type === "deadline_changed") {
    return {
      icon: Calendar,
      title: `Due date updated on “${item.cardTitle}”`,
      detail: `On ${item.boardName}`,
    };
  }
  if (item.type === "card_completed") {
    return {
      icon: CheckCircle2,
      title: `“${item.cardTitle}” was marked complete`,
      detail: `On ${item.boardName}`,
    };
  }
  return {
    icon: Bell,
    title: item.cardTitle || item.boardName,
    detail: item.boardName,
  };
}

interface HomeWidgetsProps {
  notifications: AppNotification[];
  loading: boolean;
  onOpen: (item: AppNotification) => void;
  onMarkAllRead: () => void;
}

export default function HomeWidgets({
  notifications,
  loading,
  onOpen,
  onMarkAllRead,
}: HomeWidgetsProps) {
  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center text-lg font-semibold min-w-0">
          <Bell className="inline-block w-4 h-4 mr-2 shrink-0" />
          Notifications
          {!loading && unreadCount > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">
              {unreadCount}
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="shrink-0 text-xs text-gray-300 hover:text-white"
          >
            Mark all read
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-gray-400">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((item) => {
            const copy = notificationCopy(item);
            const Icon = copy.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className={`w-full text-left rounded-xl border border-border p-3 transition hover:bg-border-hover ${
                    item.read ? "bg-background" : "bg-background-alt"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="relative mt-0.5 shrink-0">
                      <Icon className="w-4 h-4 text-gray-300" />
                      {!item.read && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm truncate ${
                          item.read
                            ? "font-medium text-gray-200"
                            : "font-semibold text-white"
                        }`}
                      >
                        {copy.title}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
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
    </section>
  );
}
