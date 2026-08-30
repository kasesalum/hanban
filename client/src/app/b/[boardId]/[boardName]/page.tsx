import BoardPage from "./page_client";

interface PageProps {
  params: Promise<{ boardId: string; boardName: string }>;
}

export default async function Page({ params }: PageProps) {
  const { boardId, boardName } = await params;

  return <BoardPage boardId={boardId} boardName={boardName} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { boardName } = await params;

  return {
    title: decodeURIComponent(boardName) || "Board",
  };
}
