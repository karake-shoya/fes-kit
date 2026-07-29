import Link from "next/link";
import {
  Calculator,
  ChevronRight,
  Wallet,
  Users,
  TriangleAlert,
  ClipboardList,
  Info,
  Plus,
  Layers,
} from "lucide-react";
import { requireProjectPage } from "@/lib/auth";
import { getSimulationInput } from "@/db/queries/simulation";
import { SCENARIO_LIMIT, type ScenarioWithItems } from "@/db/queries/scenarios";
import { AppHeader } from "@/components/app/app-header";
import { PageMain, EmptyState } from "@/components/app/page-shell";
import { ScenarioDialog } from "@/components/app/scenario-dialog";
import { ScenarioCard } from "@/components/app/scenario-card";
import { Button } from "@/components/ui/button";
import {
  calcBreakeven,
  calcScenarioProfit,
  calcPurchaseRate,
  type BreakevenResult,
  type BreakevenRecipe,
} from "@/lib/breakeven";
import { formatYen } from "@/lib/format";

/**
 * 採算シミュレーション（計算のみ）。
 *
 * 「今の価格のまま、かかるお金を回収するには何個売ればいいか」を出す画面。
 * 金額・個数はすべて lib/breakeven.ts の純粋関数で計算し、
 * ここは結果の見せ方だけを持つ。
 */
export default async function SimulationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ canEdit }, input] = await Promise.all([
    requireProjectPage(id),
    getSimulationInput(id),
  ]);

  const result = calcBreakeven(input.recipes, input.fixedCost);
  const purchaseRate = calcPurchaseRate(result.totalQuantity, input.expectedVisitors);

  // 「今の作る予定数を全部売り切ったらいくら残るか」（＝いま立てている計画の答え合わせ）
  const plan = calcScenarioProfit(
    result.lines.map((l) => ({
      sellingPrice: l.sellingPrice,
      unitCost:     l.unitCost,
      quantity:     l.servings,
    })),
    input.fixedCost
  );
  const planQuantity = result.lines.reduce((sum, l) => sum + l.servings, 0);

  return (
    <>
      <AppHeader title="採算シミュレーション" backHref={`/projects/${id}`} />

      <PageMain gap={4}>
        {result.status === "noRecipes" ? (
          <EmptyState icon={Calculator}>
            材料と商品を登録すると、
            <br />
            「何個売ればトントンか」を計算できます。
          </EmptyState>
        ) : (
          <>
            <BreakevenHero projectId={id} result={result} />

            <VisitorCheck
              projectId={id}
              expectedVisitors={input.expectedVisitors}
              purchaseRate={purchaseRate}
              totalQuantity={result.totalQuantity}
              show={result.status === "ok"}
            />

            {/* 今の計画（作る予定数を全部売ったら）の答え合わせ */}
            {planQuantity > 0 && (
              <section className="bg-card rounded-2xl border border-border px-4 py-4 flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  今の作る予定数を全部売ったら
                </h2>
                <div className="flex items-end justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    全部で{planQuantity}個・売上 {formatYen(plan.revenue)}
                  </span>
                  <span
                    className={`text-2xl font-bold tabular-nums ${
                      plan.profit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatYen(plan.profit)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  売上から材料費 {formatYen(plan.ingredientCost)} と
                  かかるお金 {formatYen(input.fixedCost)} を引いた手残りです。
                </p>
              </section>
            )}

            <ScenarioSection
              projectId={id}
              scenarios={input.scenarios}
              recipes={input.recipes}
              fixedCost={input.fixedCost}
              expectedVisitors={input.expectedVisitors}
              canEdit={canEdit}
            />

            {/* 商品ごとの内訳 */}
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-foreground px-1">商品ごとの内訳</h2>
              <ul className="flex flex-col gap-2">
                {result.lines.map((line) => (
                  <li
                    key={line.recipeId}
                    className="rounded-xl border border-border bg-card px-3 py-3 shadow-sm flex items-center gap-3"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {line.name}
                      </span>
                      <span className="text-xs text-muted-foreground/70 tabular-nums">
                        {formatYen(line.sellingPrice)}・1個の利益{" "}
                        <span className={line.marginPerUnit >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatYen(line.marginPerUnit)}
                        </span>
                      </span>
                    </div>
                    <div className="ml-auto shrink-0 text-right">
                      {result.status === "ok" ? (
                        <>
                          <span className="text-base font-bold text-foreground tabular-nums">
                            {line.quantity}個
                          </span>
                          <span className="block text-xs text-muted-foreground/70 tabular-nums">
                            予定 {line.servings}個
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/70 tabular-nums">
                          予定 {line.servings}個
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* 原価未登録で計算から外した商品（黙って除くと数字を信用できなくなる） */}
            {result.excluded.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
                <Info className="w-4 h-4 shrink-0 mt-px" />
                <span>
                  {result.excluded.map((e) => e.name).join("・")}
                  は材料が未登録のため計算から外しています。
                  材料を登録すると一緒に計算できます。
                </span>
              </p>
            )}

            <ExpensesLink projectId={id} fixedCost={input.fixedCost} />
          </>
        )}
      </PageMain>
    </>
  );
}

/**
 * 採算パターン（値段と個数を変えた案）の一覧。
 *
 * 実績記録ページに仮の数字を入れて確かめる、という元の困りごとの受け皿。
 * ここで何案作っても商品の情報は変わらず、「これにする」で初めて反映される。
 */
function ScenarioSection({
  projectId,
  scenarios,
  recipes,
  fixedCost,
  expectedVisitors,
  canEdit,
}: {
  projectId: string;
  scenarios: ScenarioWithItems[];
  recipes: BreakevenRecipe[];
  fixedCost: number;
  expectedVisitors: number | null;
  canEdit: boolean;
}) {
  // 閲覧者で1件も無いときは、操作できない空欄を見せても意味がないので出さない
  if (!canEdit && scenarios.length === 0) return null;

  const canAdd = canEdit && scenarios.length < SCENARIO_LIMIT;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-primary" />
          パターンで比べる
        </h2>
        {canAdd && (
          <ScenarioDialog
            projectId={projectId}
            recipes={recipes}
            fixedCost={fixedCost}
            expectedVisitors={expectedVisitors}
          >
            <Button size="sm" variant="outline" className="ml-auto h-8">
              <Plus className="w-4 h-4" /> 追加
            </Button>
          </ScenarioDialog>
        )}
      </div>

      {scenarios.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground leading-relaxed">
          値段と売る個数を変えた案を保存して、手残りを見くらべられます。
          <br />
          何案ためしても商品の情報は変わりません。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              projectId={projectId}
              scenario={scenario}
              recipes={recipes}
              fixedCost={fixedCost}
              expectedVisitors={expectedVisitors}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && scenarios.length >= SCENARIO_LIMIT && (
        <p className="px-1 text-xs text-muted-foreground/70">
          パターンは{SCENARIO_LIMIT}件までです。新しく作るときは使わないものを削除してください。
        </p>
      )}
    </section>
  );
}

// 損益分岐点の見出しカード。状態ごとに「次に何をすればいいか」まで出す
function BreakevenHero({
  projectId,
  result,
}: {
  projectId: string;
  result: BreakevenResult;
}) {
  if (result.status === "noFixedCost") {
    return (
      <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-5 flex flex-col gap-3 shadow-sm">
        <p className="text-sm text-foreground leading-relaxed">
          出店料やレンタル代を登録すると、
          <br />
          「何個売ればトントンか」を計算できます。
        </p>
        <Link
          href={`/projects/${projectId}/expenses`}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground active:opacity-80 transition-opacity"
        >
          <Wallet className="w-4 h-4" />
          かかるお金を登録する
        </Link>
      </section>
    );
  }

  if (result.status === "unprofitable") {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <TriangleAlert className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 leading-relaxed">
            今の価格では、何個売ってもかかるお金
            {formatYen(result.fixedCost)}を回収できません。
            先に販売価格か材料を見直しましょう。
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/recipes`}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 active:opacity-80 transition-opacity"
        >
          商品の価格を見直す
          <ChevronRight className="w-4 h-4" />
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-5 flex flex-col gap-2 shadow-sm">
      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Calculator className="w-3.5 h-3.5" />
        今の価格のままなら
      </p>
      <p className="text-foreground leading-none">
        <span className="text-sm">全部で</span>
        <span className="mx-1 text-4xl font-bold tabular-nums text-primary">
          {result.totalQuantity}
        </span>
        <span className="text-sm">個 売ればトントン</span>
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        かかるお金 {formatYen(result.fixedCost)} を売上で回収できる個数です。
        これを超えた分が手元に残ります。
      </p>
    </section>
  );
}

// 想定来場者数に対して現実的な個数かのチェック
function VisitorCheck({
  projectId,
  expectedVisitors,
  purchaseRate,
  totalQuantity,
  show,
}: {
  projectId: string;
  expectedVisitors: number | null;
  purchaseRate: number | null;
  totalQuantity: number;
  show: boolean;
}) {
  if (!show) return null;

  if (purchaseRate === null) {
    return (
      <Link
        href={`/projects/${projectId}/settings`}
        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-xs text-muted-foreground active:scale-[0.98] transition-transform"
      >
        <Users className="w-4 h-4 shrink-0 text-muted-foreground/60" />
        <span className="leading-relaxed">
          設定に想定来場者数を入れると、この個数が現実的かを判定できます。
        </span>
        <ChevronRight className="ml-auto w-4 h-4 shrink-0 text-muted-foreground/40" />
      </Link>
    );
  }

  const percent = Math.round(purchaseRate * 100);
  const tooMany = purchaseRate > 1;

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-xs leading-relaxed ${
        tooMany
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {tooMany ? (
        <TriangleAlert className="w-4 h-4 shrink-0 text-red-500" />
      ) : (
        <Users className="w-4 h-4 shrink-0 text-muted-foreground/60" />
      )}
      <span>
        来場者{expectedVisitors}人のうち{percent}%が買う計算です（{totalQuantity}個）。
        {tooMany && "来場者全員が1個以上買う前提になっています。価格を上げるか、かかるお金を減らせないか見直しましょう。"}
      </span>
    </div>
  );
}

// かかるお金の内訳を確認・編集する導線
function ExpensesLink({ projectId, fixedCost }: { projectId: string; fixedCost: number }) {
  return (
    <Link
      href={`/projects/${projectId}/expenses`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10">
        <Wallet className="w-4.5 h-4.5 text-primary" />
      </span>
      <span className="text-sm font-medium text-foreground">かかるお金</span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <span className="text-sm text-muted-foreground tabular-nums">{formatYen(fixedCost)}</span>
        <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
      </span>
    </Link>
  );
}
