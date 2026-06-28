// ルート遷移中に即座に表示するスケルトン。
// リモートDB（Turso）のクエリ完了を待たずに画面が反応するため、体感速度が上がる。
export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-4">
        <div className="h-5 w-32 rounded bg-zinc-200 animate-pulse" />
      </header>
      <main className="px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-zinc-200 px-4 py-5 shadow-sm flex flex-col gap-3"
          >
            <div className="h-4 w-2/3 rounded bg-zinc-200 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-zinc-100 animate-pulse" />
          </div>
        ))}
      </main>
    </div>
  );
}
