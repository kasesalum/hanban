"use client";

import type { ReactNode } from "react";
import Sidebar, { type SidebarUser } from "./sidebar";
import { SidebarProvider } from "./sidebarContext";

interface AppShellProps {
  userName: string;
  user: SidebarUser;
  onSignOut: () => void;
  unreadCount?: number;
  mainClassName?: string;
  children: ReactNode;
}

export default function AppShell({
  userName,
  user,
  onSignOut,
  unreadCount,
  mainClassName,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-gray-100">
        <Sidebar
          onSignOut={onSignOut}
          userName={userName}
          user={user}
          unreadCount={unreadCount}
        />
        <div
          className={
            mainClassName ?? "flex-1 min-w-0 overflow-y-auto flex flex-col"
          }
        >
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
