import TablePageClient from "./page.client";

export default function TablePage({ params }: { params: { code: string } }) {
  return <TablePageClient code={params.code} />;
}
