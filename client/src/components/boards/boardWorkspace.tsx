"use client";

import AppShell from "@/components/navigation/appShell";
import PageHeader from "@/components/navigation/pageHeader";
import type { SidebarUser } from "@/components/navigation/sidebar";
import type { ReactNode } from "react";

type BoardBackground = {
  type: "color" | "preset" | "upload";
  value: string;
};

export default function BoardWorkspace({
  user,
  userName,
  onSignOut,
  title,
  leading,
  actions,
  background,
  children,
}: {
  user: SidebarUser;
  userName: string;
  onSignOut: () => void;
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
  background?: BoardBackground;
  children: ReactNode;
}) {
  return (
    <AppShell
      onSignOut={onSignOut}
      userName={userName}
      user={user}
      mainClassName="relative flex-1 min-w-0 flex flex-col overflow-hidden"
    >
      {background?.type === "color" ? (
        <div
          className="absolute inset-0"
          style={{ background: background.value }}
        />
      ) : background?.value ? (
        <img
          src={background.value}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-background" />
      )}
      <div className="absolute inset-0 bg-black/25" />

      <PageHeader
        variant="overlay"
        title={title}
        leading={leading}
        actions={actions}
      />

      {children}
    </AppShell>
  );
}
