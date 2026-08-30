"use client";

import Sidebar from "@/components/navigation/sidebar";
import { auth } from "@/lib/firebase";
import { getBoardInfo } from "@/lib/helper";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BoardPageProps {
  boardId: string;
  boardName: string;
}

type BoardInfo = {
  id: string;
  name?: string;
  urlName?: string;
  privacy?: string;
  background?: {
    type: "color" | "preset" | "upload";
    value: string;
  };
};

const EMPTY_COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export default function BoardPage({ boardId, boardName }: BoardPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [loading, setLoading] = useState(true);

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
    const fetchBoard = async () => {
      if (!user) return;
      setLoading(true);
      const info = await getBoardInfo(boardId);
      setBoard(info);
      setLoading(false);
    };

    fetchBoard();
  }, [user, boardId]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const userName = user?.displayName?.replace(/\s+/g, "") || "unknown";
  const title = board?.name || decodeURIComponent(boardName) || "Untitled Board";

  return (
    <div className="flex min-h-screen bg-background text-gray-100">
      <Sidebar onSignOut={handleSignOut} userName={userName} user={user} />

      <main className="relative flex-1 min-w-0 flex flex-col overflow-hidden">
        {board?.background?.type === "color" ? (
          <div
            className="absolute inset-0"
            style={{ background: board.background.value }}
          />
        ) : board?.background?.value ? (
          <img
            src={board.background.value}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-background" />
        )}
        <div className="absolute inset-0 bg-black/25" />

        <header className="relative z-10 flex max-h-16 items-center justify-between px-8 py-4 border-b border-white/10 bg-black/25 backdrop-blur-sm w-full">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{title}</h1>
            {board?.privacy && (
              <span className="shrink-0 text-xs uppercase tracking-wide px-2 py-1 rounded-md bg-black/40 text-gray-200">
                {board.privacy}
              </span>
            )}
          </div>
        </header>

        <div className="relative z-10 flex-1 overflow-x-auto overflow-y-hidden p-6">
          {loading ? (
            <p className="text-white/80">Loading board…</p>
          ) : !board ? (
            <p className="text-white/80">Board not found.</p>
          ) : (
            <div className="flex gap-4 h-full items-start">
              {EMPTY_COLUMNS.map((column) => (
                <section
                  key={column.id}
                  className="w-72 shrink-0 rounded-xl bg-background/90 border border-border shadow-md flex flex-col max-h-full"
                >
                  <h2 className="px-4 py-3 font-semibold text-gray-100">
                    {column.title}
                  </h2>
                  <div className="px-4 pb-3 text-sm text-gray-400">
                    No cards yet
                  </div>
                  <button
                    type="button"
                    className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-border-hover transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add a card
                  </button>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
