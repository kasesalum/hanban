"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function BoardInfoTip({ info }: { info: string }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const open = pinned || hovered;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setPinned(false);
        setHovered(false);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPinned(false);
        setHovered(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  if (!info.trim()) return null;

  return (
    <div
      className="relative shrink-0"
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        title="Board info"
        aria-label="Board info"
        aria-expanded={open}
        onClick={() => setPinned((prev) => !prev)}
        className="inline-flex items-center justify-center p-1.5 rounded-md bg-black/40 border border-white/10 text-gray-200 hover:text-white"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 pt-2">
          <div
            role="tooltip"
            className="w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-md bg-background-alt border border-white/10 shadow-lg p-3 text-sm text-gray-200 whitespace-pre-wrap"
          >
            {info}
          </div>
        </div>
      )}
    </div>
  );
}
