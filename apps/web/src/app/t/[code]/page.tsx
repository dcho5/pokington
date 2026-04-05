import dynamic from 'next/dynamic';
const TablePageClient = dynamic(() => import('./page.client'), { ssr: false });

export default function TablePage({ params }: { params: { code: string } }) {
  return <TablePageClient code={params.code} />;
}
