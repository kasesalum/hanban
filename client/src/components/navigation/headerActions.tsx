"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface HeaderActionsProps {
  primary?: ReactNode;
  children?: ReactNode;
  overlay?: boolean;
}

export default function HeaderActions({
  primary,
  children,
  overlay = false,
}: HeaderActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasOverflow = Boolean(children);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const menuButtonClass = overlay
    ? "p-2 rounded-md bg-black/40 border border-white/10 text-gray-200"
    : "p-2 rounded-md border border-border text-gray-300 hover:bg-border-hover";

  const menuPanelClass = overlay
    ? "absolute right-0 mt-2 z-50 min-w-52 rounded-md bg-background-alt border border-white/10 shadow-lg p-3 flex flex-col gap-3"
    : "absolute right-0 mt-2 z-50 min-w-52 rounded-md bg-background-alt border border-border shadow-lg p-3 flex flex-col gap-3";

  return (
    <div className="flex items-center gap-2 shrink-0">
      {primary}
      {hasOverflow && (
        <>
          <div className="hidden sm:flex items-center gap-2">{children}</div>
          <div className="relative sm:hidden" ref={menuRef}>
            <button
              type="button"
              title="More actions"
              onClick={() => setMenuOpen((prev) => !prev)}
              className={menuButtonClass}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {menuOpen && <div className={menuPanelClass}>{children}</div>}
          </div>
        </>
      )}
    </div>
  );
}
