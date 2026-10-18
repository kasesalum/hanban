"use client";

import AssignedTickets from "@/components/boards/assignedTickets";
import HomeWidgets from "@/components/home/homeWidgets";
import AppShell from "@/components/navigation/appShell";
import PageHeader from "@/components/navigation/pageHeader";
import { auth } from "@/lib/firebase";
import {
  getUserNotifications,
  getUserTickets,
  markAllNotificationsRead,
  markNotificationRead,
  openBoard,
  type AppNotification,
  type UserTicket,
} from "@/lib/helper";
import { onAuthStateChanged, signOut, User } from "@firebase/auth";
import { House } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface HomePageProps {
  userName: string;
}

export default function HomePage({ userName }: HomePageProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<{
    todo: UserTicket[];
    inProgress: UserTicket[];
  }>({ todo: [], inProgress: [] });
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

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
    if (!user?.uid) return;
    let cancelled = false;
    setTicketsLoading(true);
    getUserTickets(user.uid).then((data) => {
      if (cancelled) return;
      setTickets(data);
      setTicketsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    setNotificationsLoading(true);
    getUserNotifications(user.uid).then((data) => {
      if (cancelled) return;
      setNotifications(data.notifications);
      setNotificationsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleOpenNotification = async (item: AppNotification) => {
    if (!user) return;
    if (!item.read) {
      await markNotificationRead(item.id, user.uid);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === item.id
            ? { ...notification, read: true }
            : notification
        )
      );
    }
    const boardName = encodeURIComponent(item.urlName || "board");
    router.push(`/b/${item.boardId}/${boardName}`);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    const ok = await markAllNotificationsRead(user.uid);
    if (ok) {
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, read: true }))
      );
    }
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <AppShell
      onSignOut={handleSignOut}
      userName={userName}
      user={user}
      unreadCount={notificationsLoading ? undefined : unreadCount}
      mainClassName="flex-1 min-w-0 flex flex-col overflow-hidden"
    >
      <PageHeader title="Home" icon={<House className="w-6 h-6" />} />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <AssignedTickets
              todo={tickets.todo}
              inProgress={tickets.inProgress}
              loading={ticketsLoading}
              onOpen={(ticket) =>
                user && openBoard(ticket.boardId, user, router, ticket.urlName)
              }
            />
          </div>
          <div className="lg:hidden px-4 pb-8 sm:px-6">
            <HomeWidgets
              notifications={notifications}
              loading={notificationsLoading}
              onOpen={handleOpenNotification}
              onMarkAllRead={handleMarkAllRead}
            />
          </div>
        </main>

        <aside className="hidden lg:block w-80 border-l border-border px-6 py-6 overflow-y-auto bg-background/40">
          <HomeWidgets
            notifications={notifications}
            loading={notificationsLoading}
            onOpen={handleOpenNotification}
            onMarkAllRead={handleMarkAllRead}
          />
        </aside>
      </div>
    </AppShell>
  );
}
