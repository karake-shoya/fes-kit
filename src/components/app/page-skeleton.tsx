// 画面遷移中に出すスケルトン。
// リモートDB（Turso）のクエリ完了を待たずに画面が反応するため、体感速度が上がる。
// ヘッダー1本＋カード数枚という、このアプリのほぼ全画面に共通する骨格を描く。
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="mx-auto max-w-lg">
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        </div>
      </header>
      <main className="px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="bg-card rounded-2xl border border-border px-4 py-5 shadow-sm flex flex-col gap-3"
          >
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </main>
    </>
  );
}
