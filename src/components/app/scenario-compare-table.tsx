import { Crown, ChevronRight } from "lucide-react";
import {
  evaluateScenario,
  calcPurchaseRate,
  type BreakevenRecipe,
  type ScenarioLineInput,
} from "@/lib/breakeven";
import { formatYen } from "@/lib/format";

type Props = {
  /** 今の商品と原価（原価はどの案でも材料マスタの最新値を使う） */
  recipes: BreakevenRecipe[];
  scenarios: { id: string; name: string; items: ScenarioLineInput[] }[];
  fixedCost: number;
  expectedVisitors: number | null;
};

// 列の最小幅。スマホ幅（375px）で「今」＋2案までは横スクロールなしで収まる
const COL_CLASS = "min-w-[5.5rem]";

/**
 * パターンを横に並べて見くらべる表。
 *
 * カード一覧は「1案ずつの答え」を出すが、「A案とB案でたこ焼きの値段がどう違うか」は
 * 縦に並んだカードを行き来しないと分からない。ここは**商品ごとの突き合わせ**を担う。
 *
 * いちばん左の列は**今の設定**。案どうしだけを比べても「今より良いのか」に
 * 答えられないため、常に比較の基準として並べる。
 * 対話しない表示だけの表なので、クライアントJSを増やさずサーバーで組み立てる。
 */
export function ScenarioCompareTable({
  recipes,
  scenarios,
  fixedCost,
  expectedVisitors,
}: Props) {
  // 「今」も1つの案として同じ関数で評価する（数字の出どころを揃えるため）
  const columns = [
    {
      id:     "current",
      label:  "今",
      result: evaluateScenario(
        recipes,
        recipes.map((r) => ({
          recipeId:     r.recipeId,
          sellingPrice: r.sellingPrice,
          quantity:     r.servings,
        })),
        fixedCost
      ),
    },
    ...scenarios.map((s) => ({
      id:     s.id,
      label:  s.name,
      result: evaluateScenario(recipes, s.items, fixedCost),
    })),
  ].map((col) => ({
    ...col,
    purchaseRate: calcPurchaseRate(col.result.totalQuantity, expectedVisitors),
  }));

  // 手残りがいちばん多い列に印を付ける（どれを選べばいいかの一番の手がかり）
  const bestProfit = Math.max(...columns.map((c) => c.result.profit));

  // 行の並びは商品の並び。原価未登録は全列で除外されるので「今」の行を基準にできる
  const productRows = columns[0].result.lines;

  return (
    <details open={scenarios.length >= 2} className="group">
      {/* 既定の三角マーカーは Safari だけ別の擬似要素なので、両方消して自前の矢印に揃える */}
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-90" />
        表で見くらべる（商品ごとの値段と個数）
      </summary>

      <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              {/* 左上の角。行見出しの列と案の列が交わるだけの空セル */}
              <th className="sticky left-0 z-10 border-b border-border bg-card px-3 py-2" />

              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`${COL_CLASS} border-b border-l border-border px-2 py-2 text-center font-medium text-foreground`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.result.profit === bestProfit && (
                      <Crown className="w-3 h-3 shrink-0 text-amber-500" aria-label="いちばん残る" />
                    )}
                    <span className="truncate">{col.label}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* いちばん知りたい数字を最上段に置く */}
            <tr>
              <th className="sticky left-0 z-10 border-b border-border bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                手残り
              </th>
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={`border-b border-l border-border px-2 py-2 text-center font-bold tabular-nums ${
                    col.result.profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatYen(col.result.profit)}
                </td>
              ))}
            </tr>

            <tr>
              <th className="sticky left-0 z-10 border-b border-border bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                売る個数
              </th>
              {columns.map((col) => (
                <td
                  key={col.id}
                  className="border-b border-l border-border px-2 py-2 text-center tabular-nums text-foreground"
                >
                  {col.result.totalQuantity}個
                </td>
              ))}
            </tr>

            {expectedVisitors ? (
              <tr>
                <th className="sticky left-0 z-10 border-b border-border bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  購入率
                </th>
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={`border-b border-l border-border px-2 py-2 text-center tabular-nums ${
                      col.purchaseRate !== null && col.purchaseRate > 1
                        ? "text-red-600"
                        : "text-foreground"
                    }`}
                  >
                    {col.purchaseRate === null
                      ? "—"
                      : `${Math.round(col.purchaseRate * 100)}%`}
                  </td>
                ))}
              </tr>
            ) : null}

            {/* 商品ごとの値段と個数（ここが「A案とB案で何が違うか」の中身） */}
            {productRows.map((row) => (
              <tr key={row.recipeId}>
                <th className="sticky left-0 z-10 border-b border-border bg-card px-3 py-2 text-left font-medium text-foreground">
                  <span className="block max-w-[7rem] truncate">{row.name}</span>
                </th>
                {columns.map((col) => {
                  const cell = col.result.lines.find((l) => l.recipeId === row.recipeId);
                  return (
                    <td
                      key={col.id}
                      className="border-b border-l border-border px-2 py-2 text-center tabular-nums"
                    >
                      <span className="block font-medium text-foreground">
                        {cell ? formatYen(cell.sellingPrice) : "—"}
                      </span>
                      <span className="block text-muted-foreground/70">
                        {cell ? `${cell.quantity}個` : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-1 pt-1.5 text-xs text-muted-foreground/70">
        原価はどの案でも今の材料費で計算しています。
        {columns[0].result.excluded.length > 0 && (
          <>
            {columns[0].result.excluded.map((e) => e.name).join("・")}
            は材料が未登録のため入っていません。
          </>
        )}
      </p>
    </details>
  );
}
