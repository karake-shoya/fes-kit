import Link from "next/link";
import { Store, Wallet, ChevronRight } from "lucide-react";
import { requireProjectPage } from "@/lib/auth";
import { getSalesResults } from "@/db/queries/sales-records";
import { getExpenseSummary } from "@/db/queries/expenses";
import { AppHeader } from "@/components/app/app-header";
import { PageMain, EmptyState } from "@/components/app/page-shell";
import { SalesRecordCard } from "@/components/app/sales-record-card";
import { formatYen } from "@/lib/format";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ canEdit }, { items, totalExpected, totalActual }, expenses] = await Promise.all([
    requireProjectPage(id),
    getSalesResults(id),
    getExpenseSummary(id),
  ]);

  // 1件でも実績が入っていれば「実績合計」を意味のある数字として見せる
  const hasRecords = items.some((it) => it.recorded);

  // ここまでの「利益」は材料費しか引いていない。出店料などのかかるお金を引いて
  // 実際に手元に残る額を出す（引かないと実態より多く見えてしまう）
  const actualNet = totalActual - expenses.total;

  return (
    <>
      <AppHeader title="売上・実績記録" backHref={`/projects/${id}`} />

      <PageMain gap={4}>
        {items.length === 0 ? (
          <EmptyState icon={Store}>
            レシピを登録すると、当日の
            <br />
            「作った数」「売れた数」をここで記録できます。
          </EmptyState>
        ) : (
          <>
            {/* 見込み vs 実績のサマリーヒーロー */}
            <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-4 shadow-sm flex flex-col gap-3">
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

              {/* 上の「利益」は材料費しか引いていない。かかるお金まで引いた手残りを続けて出す */}
              {expenses.total > 0 ? (
                <div className="border-t border-primary/15 pt-3 flex flex-col gap-1">
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      かかるお金 {formatYen(expenses.total)} を引いた手残り
                    </span>
                    <span
                      className={`text-2xl font-bold tabular-nums ${
                        !hasRecords
                          ? "text-muted-foreground/50"
                          : actualNet >= 0
                            ? "text-green-600"
                            : "text-red-600"
                      }`}
                    >
                      {hasRecords ? formatYen(actualNet) : "未記録"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    出店料やレンタル代まで引いた、実際に手元に残る金額です。
                  </p>
                </div>
              ) : (
                <Link
                  href={`/projects/${id}/expenses`}
                  className="border-t border-primary/15 pt-3 flex items-center gap-2 text-xs text-muted-foreground active:opacity-70 transition-opacity"
                >
                  <Wallet className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                  <span className="leading-relaxed">
                    上の利益は材料費だけを引いた金額です。出店料などを登録すると手残りが分かります。
                  </span>
                  <ChevronRight className="ml-auto w-4 h-4 shrink-0 text-muted-foreground/40" />
                </Link>
              )}
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
      </PageMain>
    </>
  );
}
