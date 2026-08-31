import NotificationsPage from "./page_client";

interface PageProps {
  params: Promise<{ userName: string }>;
}

export default async function Page({ params }: PageProps) {
  const { userName } = await params;

  return <NotificationsPage userName={userName} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { userName } = await params;

  return {
    title: `Notifications | ${userName}`,
  };
}
