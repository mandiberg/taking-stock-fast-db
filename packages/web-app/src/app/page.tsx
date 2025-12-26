export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center px-8">
      <div className="max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Taking Stock
          </h1>
          <p className="text-lg text-muted-foreground italic">
            A quantitative analysis of stock photography
          </p>
        </header>
        <div className="space-y-4 text-base leading-relaxed">
          <p>
            This interface provides natural language access to a database of
            tens of millions of stock photographs, enabling exploration of
            demographic patterns, geographic distributions, and visual
            clustering across the commercial image landscape.
          </p>
          <p className="text-muted-foreground">
            Use the chat panel to query the data. Ask about gender distributions,
            ethnicity patterns, pose clusters, topic modeling results, or any
            combination thereof.
          </p>
        </div>
      </div>
    </div>
  );
}
