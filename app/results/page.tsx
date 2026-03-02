import ResultsClient from "@/components/ResultsClient";

export default async function ResultsPage({
  searchParams
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const params = await searchParams;
  const prompt = (params.prompt ?? "").slice(0, 800);

  return (
    <main>
      <h1>Recommendations</h1>
      <p className="meta">Search-only mode for robust compatibility under Spotify endpoint restrictions.</p>
      <ResultsClient initialPrompt={prompt} />
    </main>
  );
}
