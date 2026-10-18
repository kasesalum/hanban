"use client";

import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { getBoardInfo, pinBoard, openBoard } from "@/lib/helper";
import { useBoardCache, useUserBoards } from "@/lib/useBoards";
import {
  LayoutDashboard,
  Plus,
  Star,
  Component,
} from "lucide-react";
import AppShell from "@/components/navigation/appShell";
import HeaderActions from "@/components/navigation/headerActions";
import PageHeader from "@/components/navigation/pageHeader";
import BoardCard from "@/components/boards/boardCard";
import BoardCreationModal from "@/components/boards/boardCreationModal";
import Loading from "@/components/loading";

interface DashboardPageProps {
  userName: string;
}

export default function DashboardPage({ userName }: DashboardPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const { boards: memberBoards, pinned, loading } = useUserBoards(user?.uid);
  const { setPinned, upsertBoard, invalidateUserBoards } = useBoardCache();
  const pinnedSet = new Set(pinned);
  const boards = memberBoards.map((board) => ({
    ...board,
    id: board.id || board.objectID || "",
    pinned: pinnedSet.has(board.id || board.objectID || ""),
  }));

  function redirectToUserBoards(
    user: User,
    router: ReturnType<typeof useRouter>
  ) {
    const name = user.displayName?.trim();
    if (name) router.replace(`/u/${name}/boards`);
  }

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
    const name = user?.displayName?.trim();
    if (name) {
      if (user) redirectToUserBoards(user, router);
    }
  }, [user, router]);

  /* Listen for Firebase auth state changes
   * - If user is not logged in, redirect to login page
   * - If user is logged in, store user in state
   * - If user has a display name, redirect to their boards page
   * - Cleans up the listener on component unmount
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      if (currentUser.displayName && currentUser.displayName.trim() !== "") {
        router.replace(`/u/${currentUser.displayName}/boards`);
      }
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
      console.warn("Backend disagreed, rolling back");
      setPinned(user.uid, id, isPinned);
    }
  };

  return (
    <AppShell onSignOut={handleSignOut} userName={userName} user={user}>
      <PageHeader
        title="My Boards"
        icon={<LayoutDashboard className="w-6 h-6" />}
        actions={
          <HeaderActions
            primary={
              <button
                onClick={() => setNewBoardOpen(true)}
                className="relative inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-white font-medium transition-all duration-300 ease-out group"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl pointer-events-none z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
               bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-[1px] rounded-lg bg-background-alt pointer-events-none z-10"
                />
                <span className="relative z-20 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Create Board</span>
                </span>
              </button>
            }
          />
        }
      />
      <BoardCreationModal
        open={newBoardOpen}
        onClose={() => setNewBoardOpen(false)}
        onCreated={async (newBoardId: string) => {
          if (!user) return;

          const newBoard = await getBoardInfo(newBoardId, user.uid);
          if (!newBoard) {
            invalidateUserBoards(user.uid);
            return;
          }

          upsertBoard(user.uid, { ...newBoard, pinned: false });
        }}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-10">
          <section>
            <h2 className="flex text-xl items-center font-semibold mb-3">
              <Component className="inline-block w-5 h-5 mr-3" />
              My Boards
            </h2>
            {loading ? (
              <Loading layout="page" label="Loading boards" />
            ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,11rem))] gap-4">
              {boards.length === 0 ? (
                <p className="text-gray-400">No boards yet.</p>
              ) : (
                boards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    togglePin={togglePinBoard}
                    openBoard={() =>
                      user && openBoard(board.id, user, router, board.urlName)
                    }
                  />
                ))
              )}
            </div>
            )}
          </section>
        </div>
    </AppShell>
  );
}
