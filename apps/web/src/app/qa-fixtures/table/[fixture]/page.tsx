import FixtureTablePageClient from "./page.client";

export default async function FixtureTablePage({ params }: { params: Promise<{ fixture: string }> }) {
  const { fixture } = await params;
  return <FixtureTablePageClient fixture={fixture} />;
}
