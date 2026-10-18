import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ userName: string }>;
}

export default async function Page({ params }: PageProps) {
  const { userName } = await params;
  redirect(`/u/${userName}/home`);
}
