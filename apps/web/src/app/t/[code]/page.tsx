import TablePageClient from "./page.client";

export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TablePageClient code={code} />;
}
