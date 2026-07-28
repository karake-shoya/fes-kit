import { Store } from "lucide-react";
import { requireProjectPage } from "@/lib/auth";
import { getSalesResults } from "@/db/queries/sales-records";
import { AppHeader } from "@/components/app/app-header";
import { SalesRecordCard } from "@/components/app/sales-record-card";
import { formatYen } from "@/lib/format";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ canEdit }, { items, totalExpected, totalActual }] = await Promise.all([
    requireProjectPage(id),
    getSalesResults(id),
  ]);

  // 1件でも実績が入っていれば「実績合計」を意味のある数字として見せる
  const hasRecords = items.some((it) => it.recorded);

  return (
    <>
      <AppHeader title="売上・実績記録" backHref={`/projects/${id}`} />

      <main className="px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Store className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              レシピを登録すると、当日の
              <br />
              「作った数」「売れた数」をここで記録できます。
            </p>
          </div>
        ) : (
          <>
            {/* 見込み vs 実績のサマリーヒーロー */}
            <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">見込み利益 合計</span>
                  <span className="text-xl font-bold text-foreground tabular-nums">
                    {formatYen(totalExpected)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">実績利益 合計</span>
                  <span
                    className={`text-xl font-bold tabular-nums ${
                      hasRecords ? "text-primary" : "text-muted-foreground/50"
                    }`}
                  >
                    {hasRecords ? formatYen(totalActual) : "未記録"}
                  </span>
                </div>
              </div>
            </section>

            <p className="text-xs text-muted-foreground px-1">
              イベント当日に「作った数」「売れた数」を入力すると、実績の利益が自動で計算されます。
            </p>

            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.recipe.id}>
                  <SalesRecordCard item={item} projectId={id} canEdit={canEdit} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
