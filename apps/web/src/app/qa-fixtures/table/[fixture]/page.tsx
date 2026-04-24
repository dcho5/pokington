import FixtureTablePageClient from "./page.client";

export default function FixtureTablePage({ params }: { params: { fixture: string } }) {
  return <FixtureTablePageClient fixture={params.fixture} />;
}
