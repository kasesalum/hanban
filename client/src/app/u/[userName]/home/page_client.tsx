"use client";

import HomeWidgets from "@/components/home/homeWidgets";
import AppShell from "@/components/navigation/appShell";
import PageHeader from "@/components/navigation/pageHeader";
import { auth } from "@/lib/firebase";
import { openBoard, pinBoard } from "@/lib/helper";
import { useBoardCache, useUserBoards } from "@/lib/useBoards";
import { onAuthStateChanged, signOut, User } from "@firebase/auth";
import { House, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface HomePageProps {
  userName: string;
}

export default function HomePage({ userName }: HomePageProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const { boards, pinned } = useUserBoards(user?.uid);
  const { setPinned } = useBoardCache();
  const pinnedSet = new Set(pinned);
  const boardList = boards
    .map((board) => ({
      ...board,
      id: board.id || board.objectID || "",
      pinned: pinnedSet.has(board.id || board.objectID || ""),
    }))
    .filter((board) => board.pinned);

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

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const togglePinBoard = async (id: string) => {
    if (!user?.uid) return;
    const isPinned = pinned.includes(id);
    setPinned(user.uid, id, !isPinned);
    const newStatus = await pinBoard(user.uid, id);
    if (newStatus !== !isPinned) {
      setPinned(user.uid, id, isPinned);
    }
  };

  return (
    <AppShell
      onSignOut={handleSignOut}
      userName={userName}
      user={user}
      mainClassName="flex-1 min-w-0 flex flex-col overflow-hidden"
    >
      <PageHeader
        title="Home"
        icon={<House className="w-6 h-6" />}
      />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto space-y-10">
          <div className="px-4 py-4 sm:px-6 lg:px-8">
              <h2 className="flex text-xl items-center font-semibold mb-3">
                <Inbox className="inline-block w-5 h-5 mr-3" />
                Feed
              </h2>
              <p className="mt-2 text-gray-400">No feed available.</p>
            </div>
            <div className="lg:hidden px-4 pb-8 sm:px-6">
              <HomeWidgets
                boardList={boardList}
                user={user}
                router={router}
                togglePinBoard={togglePinBoard}
                openBoard={openBoard}
              />
            </div>
          </main>

          <aside className="hidden lg:block w-80 border-l border-border px-6 py-6 overflow-y-auto bg-background/40">
            <HomeWidgets
              boardList={boardList}
              user={user}
              router={router}
              togglePinBoard={togglePinBoard}
              openBoard={openBoard}
            />
          </aside>
        </div>
    </AppShell>
  );
}
