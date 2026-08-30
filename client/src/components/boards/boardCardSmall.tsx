"use client";

import { Star } from "lucide-react";

interface BoardCardProps {
  board: {
    id: string;
    name?: string;
    pinned?: boolean;
  };
  openBoard: (id: string) => void;
  togglePin: (id: string) => void;
}

export default function BoardCardSmall({
  board,
  openBoard,
  togglePin,
}: BoardCardProps) {
  return (
    <div
      onClick={() => openBoard(board.id)}
      className="relative min-w-[250px] h-13 rounded-xl shadow-md 
    bg-background-alt hover:bg-border-hover transition cursor-pointer 
    flex flex-col group overflow-hidden"
    >
      <div className="flex p-3 items-center justify-between w-full">
        <p className="font-semibold text-lg text-white truncate">
          {board.name || "Untitled Board"}
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePin(board.id);
          }}
          className={`p-1 rounded-md shrink-0
            ${board.pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          aria-label={board.pinned ? "Unpin board" : "Pin board"}
        >
          {board.pinned ? (
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 transition-transform duration-200 ease-out hover:scale-120" />
          ) : (
            <Star className="w-5 h-5 text-gray-400 transition-transform duration-200 ease-out hover:scale-120 hover:text-yellow-400" />
          )}
        </button>
      </div>
    </div>
  );
}
