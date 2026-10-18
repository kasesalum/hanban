"use client";

import type { ReactNode } from "react";
import { BoardsProvider } from "@/lib/useBoards";

export default function Providers({ children }: { children: ReactNode }) {
  return <BoardsProvider>{children}</BoardsProvider>;
}
