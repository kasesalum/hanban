"use client";

import { PanelLeftOpen } from "lucide-react";
import type { ReactNode } from "react";
import { useSidebar } from "./sidebarContext";

interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "overlay";
}

export default function PageHeader({
  title,
  icon,
  leading,
  actions,
  variant = "default",
}: PageHeaderProps) {
  const { collapsed, toggleCollapsed, unreadCount } = useSidebar();
  const overlay = variant === "overlay";

  const headerClass = overlay
    ? "relative z-30 overflow-visible flex items-center justify-between gap-3 w-full min-w-0 px-4 py-3 sm:px-6 lg:px-8 border-b border-white/10 bg-black/25 backdrop-blur-sm"
    : "relative z-30 overflow-visible flex items-center justify-between gap-3 w-full min-w-0 px-4 py-3 sm:px-6 lg:px-8 border-b border-border";

  const menuButtonClass = overlay
    ? "lg:hidden shrink-0 p-2 rounded-lg border border-white/10 bg-black/40 text-gray-200"
    : "lg:hidden shrink-0 p-2 rounded-lg border border-border bg-background-alt text-gray-300 hover:bg-accent-hover hover:text-white";

  return (
    <header className={headerClass}>
      <div className="flex items-center gap-2 min-w-0">
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Open sidebar"
            className={menuButtonClass}
          >
            <span className="relative block">
              <PanelLeftOpen className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </span>
          </button>
        )}
        {icon && (
          <span className="hidden sm:inline-flex shrink-0">{icon}</span>
        )}
        <h1 className="text-lg sm:text-2xl font-semibold truncate">{title}</h1>
        {leading}
      </div>
      {actions}
    </header>
  );
}
