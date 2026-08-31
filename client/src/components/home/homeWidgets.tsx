"use client";

import BoardCardSmall from "@/components/boards/boardCardSmall";
import { Calendar, Star } from "lucide-react";
import type { User } from "firebase/auth";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

type StarredBoard = {
  id: string;
  name?: string;
  pinned?: boolean;
};

interface HomeWidgetsProps {
  boardList: StarredBoard[];
  user: User | null;
  router: AppRouterInstance;
  togglePinBoard: (id: string) => void;
  openBoard: (id: string, user: User, router: AppRouterInstance) => void;
}

export default function HomeWidgets({
  boardList,
  user,
  router,
  togglePinBoard,
  openBoard,
}: HomeWidgetsProps) {
  const starred = boardList.filter((b) => b.pinned);

  return (
    <div className="space-y-8">
      <section>
        <h3 className="flex items-center text-lg font-semibold mb-3">
          <Calendar className="inline-block w-4 h-4 mr-2" />
          Upcoming Deadlines
        </h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li className="flex items-center gap-2">
            <span>No upcoming deadlines.</span>
          </li>
        </ul>
      </section>

      <section>
        <h3 className="flex items-center text-lg font-semibold mb-3">
          <Star className="inline-block w-4 h-4 mr-2" />
          Starred Boards
        </h3>
        <div className="flex flex-col gap-4 pb-2">
          {starred.length === 0 ? (
            <p className="text-gray-400">No starred boards.</p>
          ) : (
            starred.map((board) => (
              <BoardCardSmall
                key={board.id}
                board={board}
                togglePin={togglePinBoard}
                openBoard={() => user && openBoard(board.id, user, router)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
