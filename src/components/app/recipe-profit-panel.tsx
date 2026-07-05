"use client";

import { useMemo, useState, useTransition } from "react";
import { Sparkles, Ghost, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RecipeIngredientEditor } from "@/components/app/recipe-ingredient-editor";
import { setRecipeSellingPrice, setRecipeServings } from "@/actions/recipe";
import { suggestSellingPrice, type PriceSuggestion } from "@/actions/ai-price";
import { useKeyedDebounce } from "@/lib/use-keyed-debounce";
import { useDraftNumberInput } from "@/lib/use-draft-number-input";
import { calcRecipeCost, roundUpTo, priceForTargetCostRate, type RecipeCostRow } from "@/lib/recipe-cost";
import { formatYen, profitStyle, costRateStyle } from "@/lib/format";

const PRICE_STEP = 10;       // 販売価格スライダーの刻み（円）
const TARGET_COST_RATE = 30; // おすすめの目安にする原価率（%）

// 原価内訳バーの材料セグメント色（落ち着いたトーンを順に割り当てる）
const COST_SEGMENT_COLORS = [
  "bg-stone-500",
  "bg-amber-700/80",
  "bg-teal-700/70",
  "bg-slate-500",
  "bg-orange-800/70",
  "bg-lime-800/60",
];

type Props = {
  recipe: { id: string; sellingPrice: number; servings: number };
  projectId: string;
  initialLines: RecipeCostRow[];   // 詳細クエリの cost.lines をそのまま渡す
  allIngredients: import("@/db/schema").Ingredient[];
  canEdit: boolean;
  aiEnabled: boolean;              // AI_GATEWAY_API_KEY 設定時のみ true
};

// レシピ詳細の「利益サマリー＋材料エディタ」を束ねるクライアントパネル。
// スライダー操作中はサーバーを待たずクライアント側で利益率を即時再計算し、
// ドラッグ確定時にだけ保存する（手数ゼロ・追従表示）。
export function RecipeProfitPanel({
  recipe,
  projectId,
  initialLines,
  allIngredients,
  canEdit,
  aiEnabled,
}: Props) {
  const [sellingPrice, setSellingPrice] = useState(recipe.sellingPrice);
  // 作る予定数（買い出しリストの必要量計算に使う）。設定ダイアログを開かず
  // ここで直接編集できるようにし、販売価格と同じ即時保存パターンに揃える。
  const [servings, setServings] = useState(recipe.servings);
  // 設定ダイアログ側での更新（router.refresh()でpropsが差し替わる）にも追従させる。
  // useStateの初期値はマウント時にしか使われないため、レンダー中にpropsの変化を検知して
  // 反映する（useEffect経由だとcascading renderになるためReact推奨のこの形にする）。
  const [prevSellingPriceProp, setPrevSellingPriceProp] = useState(recipe.sellingPrice);
  if (recipe.sellingPrice !== prevSellingPriceProp) {
    setPrevSellingPriceProp(recipe.sellingPrice);
    setSellingPrice(recipe.sellingPrice);
  }
  const [prevServingsProp, setPrevServingsProp] = useState(recipe.servings);
  if (recipe.servings !== prevServingsProp) {
    setPrevServingsProp(recipe.servings);
    setServings(recipe.servings);
  }
  // レシピ固有の情報（材料IDと使用量）だけを持つ。単価・数量などの材料マスタ情報は
  // allIngredients から都度結合するので、材料を編集→refreshすると原価へ反映される。
  const [items, setItems] = useState<{ ingredientId: string; quantityUsed: number }[]>(
    () => initialLines.map((l) => ({ ingredientId: l.ingredientId, quantityUsed: l.quantityUsed }))
  );
  const [scheduleSave] = useKeyedDebounce(500);

  // AI おすすめ価格の状態
  const [aiSuggestion, setAiSuggestion] = useState<PriceSuggestion | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();

  // 材料マスタの最新情報を結合して原価行を作る（削除済みマスタの行は除外）
  const ingById = useMemo(
    () => new Map(allIngredients.map((i) => [i.id, i])),
    [allIngredients]
  );
  const lines: RecipeCostRow[] = items.flatMap((it) => {
    const ing = ingById.get(it.ingredientId);
    if (!ing) return [];
    return [{
      ingredientId:    ing.id,
      ingredientName:  ing.name,
      unit:            ing.unit,
      pricePerUnit:    ing.price,
      quantityPerUnit: ing.quantity,
      quantityUsed:    it.quantityUsed,
    }];
  });

  const cost    = calcRecipeCost(sellingPrice, lines);
  const hasCost = lines.length > 0;
  const style   = profitStyle(cost.profitRate, hasCost);  // 利益の色（補足表示用）
  const cStyle  = costRateStyle(cost.costRate, hasCost);   // 原価率の色（主役）
  // 原価率バーの幅（0〜100%でクランプ。100%超は満タン＝赤）
  const costBarWidth = Math.max(0, Math.min(100, cost.costRate));

  const priceMax = Math.max(roundUpTo(recipe.sellingPrice * 2, PRICE_STEP), 1000);

  // 目標原価率から逆算したおすすめ価格（PRICE_STEP単位に丸める）。原価未確定なら0。
  const targetPriceRaw = priceForTargetCostRate(cost.totalCost, TARGET_COST_RATE);
  const targetPrice    = targetPriceRaw > 0 ? Math.round(targetPriceRaw / PRICE_STEP) * PRICE_STEP : 0;
  // スライダー上でのおすすめ位置（%）。min=PRICE_STEP〜max=priceMax にマッピングしクランプ。
  const targetMarkerPct =
    targetPrice > 0
      ? Math.max(0, Math.min(100, ((targetPrice - PRICE_STEP) / (priceMax - PRICE_STEP)) * 100))
      : null;

  // 原価を最も押し上げている材料（内訳バーの説明文に使う）
  const topLine =
    hasCost && cost.totalCost > 0
      ? cost.lines.reduce((a, b) => (b.lineCost > a.lineCost ? b : a))
      : null;

  function savePrice(v: number) {
    scheduleSave("price", () => {
      setRecipeSellingPrice(recipe.id, projectId, v).catch(() => {
        /* 失敗時もローカル表示は維持。次回遷移で整合 */
      });
    });
  }

  function handlePriceChange(v: number, persist: boolean) {
    setSellingPrice(v);
    if (persist) savePrice(v);
  }

  function saveServings(v: number) {
    scheduleSave("servings", () => {
      setRecipeServings(recipe.id, projectId, v).catch(() => {
        /* 失敗時もローカル表示は維持。次回遷移で整合 */
      });
    });
  }

  function handleServingsChange(v: number, persist: boolean) {
    setServings(v);
    if (persist) saveServings(v);
  }

  const priceField = useDraftNumberInput(sellingPrice, (v) => handlePriceChange(v, true), {
    isValid: (raw) => raw > 0,
  });
  const servingsField = useDraftNumberInput(servings, (v) => handleServingsChange(v, true), {
    isValid: (raw) => raw >= 1,
    integer: true,
  });

  // Claude におすすめ価格を相談する
  function askAi() {
    setAiError(null);
    startAi(async () => {
      try {
        const suggestion = await suggestSellingPrice(recipe.id, projectId);
        setAiSuggestion(suggestion);
      } catch {
        setAiError("うまく相談できませんでした。少し時間をおいて試してください。");
      }
    });
  }

  // 材料行の即時更新（子エディタから呼ばれる）
  function updateQuantity(ingredientId: string, quantityUsed: number) {
    setItems((prev) =>
      prev.map((it) => (it.ingredientId === ingredientId ? { ...it, quantityUsed } : it))
    );
  }
  function addLine(line: RecipeCostRow) {
    setItems((prev) =>
      prev.some((it) => it.ingredientId === line.ingredientId)
        ? prev
        : [...prev, { ingredientId: line.ingredientId, quantityUsed: line.quantityUsed }]
    );
  }
  function removeLine(ingredientId: string) {
    setItems((prev) => prev.filter((it) => it.ingredientId !== ingredientId));
  }

  return (
    <>
      {/* ヘッダー直下に常時表示する細い利益率バー。
          スクロールで材料を編集していても利益率・利益が画面から消えない。
          AppHeader（sticky top-0・約52px）の直下に貼り付く。 */}
      {hasCost && (
        <div className="sticky top-[52px] z-10 -mt-2 flex items-center justify-between gap-3 rounded-full border border-border bg-card/95 px-4 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className={`flex items-baseline gap-1.5 ${cStyle.text}`}>
            <span className="text-xs text-muted-foreground">原価率</span>
            <span className="text-lg font-bold leading-none tabular-nums">
              {Math.round(cost.costRate)}%
            </span>
            <span className="flex items-center gap-0.5 text-xs">
              {cStyle.Icon && <cStyle.Icon className="w-3.5 h-3.5" />}
              {cStyle.label}
            </span>
          </div>
          <div className="flex items-baseline gap-1 text-xs text-muted-foreground">
            利益
            <span className={`text-sm font-semibold tabular-nums ${style.text}`}>
              {formatYen(cost.profit)}
            </span>
          </div>
        </div>
      )}

      {/* 利益サマリー（ドラッグに追従して即時更新） */}
      <section className="bg-card rounded-2xl border border-border px-4 py-4 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">販売価格（1個）</span>
            {canEdit ? (
              <div className="flex items-baseline gap-1">
                <span className="font-semibold text-foreground">¥</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={priceField.inputValue}
                  min="1"
                  step={PRICE_STEP}
                  onFocus={priceField.onFocus}
                  onChange={priceField.onChange}
                  onBlur={priceField.onBlur}
                  onKeyDown={priceField.onKeyDown}
                  className="w-24 h-9 font-semibold text-foreground text-right"
                />
              </div>
            ) : (
              <span className="font-semibold text-foreground">{formatYen(sellingPrice)}</span>
            )}
          </div>
          {canEdit && (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Slider
                  // 0は販売価格として不正（サーバーが弾く）ため最小を1ステップにする
                  value={[Math.min(Math.max(sellingPrice, PRICE_STEP), priceMax)]}
                  min={PRICE_STEP}
                  max={priceMax}
                  step={PRICE_STEP}
                  onValueChange={(v) => handlePriceChange(v[0], false)}
                  onValueCommit={(v) => handlePriceChange(v[0], true)}
                />
                {/* 目標原価率のおすすめ位置を示す縦マーカー（つまみに重ならない細線） */}
                {targetMarkerPct !== null && (
                  <div
                    className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded-full bg-green-500/70"
                    style={{ left: `${targetMarkerPct}%`, transform: "translateX(-50%)" }}
                    aria-hidden
                  />
                )}
              </div>
              {/* タップで「原価率30%のおすすめ価格」に一発設定 */}
              {targetPrice > 0 && (
                <button
                  type="button"
                  onClick={() => handlePriceChange(targetPrice, true)}
                  className="self-start flex items-center gap-1 text-xs text-green-700 hover:underline"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  おすすめ：原価率{TARGET_COST_RATE}%なら {formatYen(targetPrice)}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">原価（1個）</span>
          <span className="font-semibold text-foreground">
            {hasCost ? formatYen(cost.totalCost) : "—"}
          </span>
        </div>

        {/* 原価率（主役）：大きな数字＋判断ラベル＋原価率バー */}
        <div className="flex flex-col gap-2 bg-background rounded-xl py-3 px-3">
          {hasCost ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">原価率</span>
                <span className={`text-3xl font-bold ${cStyle.text}`}>
                  {Math.round(cost.costRate)}%
                </span>
                <span className={`text-sm flex items-center gap-1 ${cStyle.text}`}>
                  {cStyle.Icon && <cStyle.Icon className="w-4 h-4" />}
                  {cStyle.label}
                </span>
              </div>
              {/* 販売価格に占める原価の割合を示すバー（原価率が高いほど満ちる） */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cStyle.bar}`}
                  style={{ width: `${Math.max(costBarWidth, 4)}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground/70 text-center">
              材料を追加すると原価率がわかります
            </span>
          )}
        </div>

        {/* 利益・利益率は補足として小さく併記 */}
        {hasCost && (
          <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              利益（1個）
              <span className={`ml-1.5 font-bold text-base ${style.text}`}>
                {formatYen(cost.profit)}
              </span>
            </span>
            <span className="text-muted-foreground">
              利益率
              <span className={`ml-1 font-semibold ${style.text}`}>
                {Math.round(cost.profitRate)}%
              </span>
            </span>
          </div>
        )}

        <div className="border-t border-border pt-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">作る予定数</span>
            {canEdit ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={servingsField.inputValue}
                  min="1"
                  step="1"
                  onFocus={servingsField.onFocus}
                  onChange={servingsField.onChange}
                  onBlur={servingsField.onBlur}
                  onKeyDown={servingsField.onKeyDown}
                  className="w-20 h-9 font-semibold text-foreground text-right"
                />
                <span className="text-sm text-muted-foreground">個</span>
              </div>
            ) : (
              <span className="font-semibold text-foreground">{servings}個</span>
            )}
          </div>
          {!hasCost ? (
            <p className="text-xs text-muted-foreground/70 text-center">
              買い出しリストの必要量計算に使われます
            </p>
          ) : servings > 1 ? (
            <p className="text-xs text-muted-foreground/70 text-center">
              {servings}個作ると利益は約 {formatYen(cost.profit * servings)}
            </p>
          ) : null}
        </div>

        {/* AIに価格を相談（AI_GATEWAY_API_KEY 設定時・編集者・材料ありのときのみ） */}
        {canEdit && aiEnabled && hasCost && (
          <div className="border-t border-border pt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={askAi}
              disabled={aiPending}
              className="self-stretch flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
            >
              {aiPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  考え中…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {aiSuggestion ? "もう一度相談する" : "AIに価格を相談する"}
                </>
              )}
            </button>

            {aiError && (
              <p className="text-xs text-red-600 text-center">{aiError}</p>
            )}

            {aiSuggestion && (
              <div className="flex flex-col gap-3 rounded-xl bg-background px-3 py-3">
                {/* ゆるいマスコットの吹き出しで理由を伝える */}
                <div className="flex items-start gap-2">
                  <Ghost className="w-6 h-6 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-foreground leading-relaxed">{aiSuggestion.reason}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">おすすめ価格</span>
                    <span className="text-2xl font-bold text-foreground tabular-nums">
                      {formatYen(aiSuggestion.recommendedPrice)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      原価率 約{aiSuggestion.targetCostRate}%（目安 {formatYen(aiSuggestion.priceRangeMin)}〜{formatYen(aiSuggestion.priceRangeMax)}）
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePriceChange(aiSuggestion.recommendedPrice, true)}
                    className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    この価格にする
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 材料 */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground px-1">材料（1個分）</h2>

        {/* 原価内訳バー：どの材料が原価を押し上げているか一目で分かる */}
        {topLine && (
          <div className="flex flex-col gap-1.5 px-1">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {cost.lines.map((line, i) => {
                const pct = (line.lineCost / cost.totalCost) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={line.ingredientId}
                    className={COST_SEGMENT_COLORS[i % COST_SEGMENT_COLORS.length]}
                    style={{ width: `${pct}%` }}
                    title={`${line.ingredientName} ${Math.round(pct)}%`}
                  />
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              原価の中心は{" "}
              <span className="font-medium text-foreground">{topLine.ingredientName}</span>（
              {Math.round((topLine.lineCost / cost.totalCost) * 100)}%）
            </p>
          </div>
        )}

        {canEdit ? (
          <RecipeIngredientEditor
            recipeId={recipe.id}
            projectId={projectId}
            lines={lines}
            allIngredients={allIngredients}
            onUpdateQuantity={updateQuantity}
            onAddLine={addLine}
            onRemoveLine={removeLine}
          />
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 text-center py-4">材料が登録されていません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cost.lines.map((line) => (
              <li
                key={line.ingredientId}
                className="bg-card rounded-xl border border-border px-3 py-3 flex items-center justify-between gap-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{line.ingredientName}</span>
                  <span className="text-xs text-muted-foreground">{line.quantityUsed}{line.unit}</span>
                </div>
                <span className="text-sm text-muted-foreground shrink-0">{formatYen(line.lineCost)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
