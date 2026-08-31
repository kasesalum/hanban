"use client";

import { getRecentBoards, getBoardInfo, openBoard, getUserNotifications } from "@/lib/helper";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  LogOut,
  User,
  Search,
  HelpCircleIcon,
  Settings,
  StickyNote,
  LayoutTemplate,
  Folder,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState, useRef, useEffect, Key } from "react";
import Image from "next/image";
import NavItem from "./navItemProp";
import SearchModal from "../search/searchModal";

interface SidebarProps {
  onSignOut: () => void;
  userName: string;
  user:
    | {
        photoURL?: string | null;
        displayName?: string | null;
        email?: string | null;
        uid: string;
      }
    | null
    | undefined;
  unreadCount?: number;
}

export default function Sidebar({ onSignOut, userName, user, unreadCount: unreadCountProp }: SidebarProps) {
  const router = useRouter();
  const [recentBoards, setRecentBoards] = useState<
    {
      id: Key | null | undefined;
      label: string;
      href: string;
    }[]
  >([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetchedUnread, setFetchedUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unreadCount = unreadCountProp ?? fetchedUnread;

  const navItems = [
    {
      label: "Home",
      href: `/u/${userName}/home`,
      icon: <Home className="w-5 h-5" />,
    },
    {
      label: "My Boards",
      href: `/u/${userName}/boards`,
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      label: "Notifications",
      href: `/u/${userName}/notifications`,
      icon: <Bell className="w-5 h-5" />,
      badge: unreadCount > 0,
    },
  ];

  useEffect(() => {
    async function fetchRecents() {
      if (!user || !user.uid) return;

      const boardIds = await getRecentBoards(user.uid);
      const boardsData = await Promise.all(
        boardIds.map(async (id) => {
          const info = await getBoardInfo(id);
          return info
            ? {
                id,
                label: info.name || "Untitled",
                href: `/b/${id}/${info.name || ""}`,
              }
            : null;
        })
      );

      setRecentBoards(
        boardsData.filter(Boolean) as {
          id: string;
          label: string;
          href: string;
        }[]
      );
    }

    fetchRecents();
  }, [user]);

  useEffect(() => {
    if (unreadCountProp !== undefined) return;
    if (!user?.uid) return;

    getUserNotifications(user.uid).then((data) => {
      setFetchedUnread(data.unreadCount);
    });
  }, [user, unreadCountProp]);

  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <>
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Open sidebar"
          className="lg:hidden fixed top-3 left-3 z-30 p-2 rounded-lg border border-border bg-background-alt text-gray-300 hover:bg-accent-hover hover:text-white shadow-sm"
        >
          <span className="relative block">
            <PanelLeftOpen className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </span>
        </button>
      )}

      {!collapsed && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={toggleCollapsed}
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
        />
      )}

      <aside
        className={`bg-background text-gray-200 h-screen flex flex-col border-r border-border shrink-0 transition-[width] duration-200 ease-out ${
          collapsed
            ? "hidden lg:flex w-16"
            : "w-70 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:shadow-xl"
        }`}
      >
      <div
        className={`flex items-center px-3 py-3 ${
          collapsed ? "flex-col gap-3" : "justify-between px-4"
        }`}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Expand sidebar"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-accent-hover hover:text-white transition"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <Image
              src="/scooby.png"
              alt="Scooby"
              width={40}
              height={40}
              className="object-contain"
            />
            <h2 className="text-xl font-bold">HANBAN</h2>
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-accent-hover hover:text-white transition"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>
        )}

        {user === undefined ? (
          <div className="w-9 h-9 rounded-full bg-gray-600 animate-pulse" />
        ) : user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center"
            >
              <Image
                src={user.photoURL || "/default-avatar.png"}
                alt="Profile"
                width={collapsed ? 32 : 36}
                height={collapsed ? 32 : 36}
                className="rounded-full"
              />
            </button>

            {menuOpen && (
              <div
                className={`absolute mt-2 w-48 rounded-md bg-background-alt shadow-lg border border-border z-50 ${
                  collapsed ? "left-full ml-2 top-0" : "right-0"
                }`}
              >
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-white">
                    {user.displayName || "Unnamed"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => router.push(`/u/${userName}/account`)}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-border-hover"
                >
                  <User className="inline-block w-4 h-4 mr-2" />
                  Account
                </button>
                <button
                  onClick={onSignOut}
                  className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-border-hover"
                >
                  <LogOut className="inline-block w-4 h-4 mr-2" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-600 animate-pulse" />
        )}
      </div>

      <div className={collapsed ? "px-2 py-2" : "px-4 py-2"}>
        <button
          onClick={() => setOpen(true)}
          title={collapsed ? "Search" : undefined}
          className={`relative w-full flex items-center rounded-md bg-background-alt border border-border text-left text-gray-400 hover:border-border-hover transition ${
            collapsed ? "justify-center p-2" : "px-3 py-2"
          }`}
        >
          <Search className={`w-5 h-5 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && (
            <>
              <span className="text-gray-400">Search Anything...</span>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md bg-border text-gray-300">
                ⌘K
              </div>
            </>
          )}
        </button>
      </div>

      <SearchModal open={open} onClose={() => setOpen(false)} />

      <nav
        className={`flex flex-col gap-2 flex-1 ${collapsed ? "p-2" : "p-4"}`}
      >
        {navItems.map((item) => (
          <NavItem key={item.label} {...item} collapsed={collapsed} />
        ))}

        <div className="flex justify-center my-2">
          <div className="border-t border-border w-[90%]" />
        </div>

        {!collapsed && (
          <p className="text-gray-400 font-semibold mb-1">Recent:</p>
        )}
        {recentBoards.length === 0 ? (
          !collapsed && (
            <p className="text-gray-500 text-sm">No recent boards.</p>
          )
        ) : (
          recentBoards.map((item) => (
            <NavItem
              key={item.id}
              label={item.label}
              href={item.href}
              icon={<Folder className="w-5 h-5" />}
              collapsed={collapsed}
              onClick={() =>
                typeof item.id === "string" &&
                user &&
                "emailVerified" in user &&
                openBoard(item.id, user as import("firebase/auth").User, router)
              }
            />
          ))
        )}
      </nav>
    </aside>
    </>
  );
}
