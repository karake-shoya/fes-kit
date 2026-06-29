"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RecipeIngredientEditor } from "@/components/app/recipe-ingredient-editor";
import { setRecipeSellingPrice } from "@/actions/recipe";
import { useKeyedDebounce } from "@/lib/use-keyed-debounce";
import { calcRecipeCost, roundUpTo, type RecipeCostRow } from "@/lib/recipe-cost";
import { formatYen, profitStyle } from "@/lib/format";

const PRICE_STEP = 10; // 販売価格スライダーの刻み（円）

type Props = {
  recipe: { id: string; sellingPrice: number; servings: number };
  projectId: string;
  initialLines: RecipeCostRow[];   // 詳細クエリの cost.lines をそのまま渡す
  allIngredients: import("@/db/schema").Ingredient[];
  canEdit: boolean;
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
}: Props) {
  const [sellingPrice, setSellingPrice] = useState(recipe.sellingPrice);
  // レシピ固有の情報（材料IDと使用量）だけを持つ。単価・数量などの材料マスタ情報は
  // allIngredients から都度結合するので、材料を編集→refreshすると原価へ反映される。
  const [items, setItems] = useState<{ ingredientId: string; quantityUsed: number }[]>(
    () => initialLines.map((l) => ({ ingredientId: l.ingredientId, quantityUsed: l.quantityUsed }))
  );
  // 販売価格の数値入力バッファ（編集中のみ）
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const [scheduleSave] = useKeyedDebounce(500);

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
  const style   = profitStyle(cost.profitRate, hasCost);
  // 利益率バーの幅（0〜100%でクランプ。赤字は0%幅で色だけ赤）
  const barWidth = Math.max(0, Math.min(100, cost.profitRate));

  const priceMax = Math.max(roundUpTo(recipe.sellingPrice * 2, PRICE_STEP), 1000);

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

  // 販売価格の数値入力を確定（不正値は無視して元の値を維持）
  function commitPriceDraft() {
    if (priceDraft === null) return;
    const cleaned = priceDraft.trim().replace(/,/g, "");
    const raw = Number(cleaned);
    setPriceDraft(null);
    if (cleaned === "" || Number.isNaN(raw) || raw <= 0) return;
    setSellingPrice(raw);
    savePrice(raw);
  }

  const priceInputValue = priceDraft ?? String(Math.round(sellingPrice));

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
      {/* 利益サマリー（ドラッグに追従して即時更新） */}
      <section className="bg-white rounded-2xl border border-zinc-200 px-4 py-5 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-zinc-500">販売価格（1個）</span>
            {canEdit ? (
              <div className="flex items-baseline gap-1">
                <span className="font-semibold text-zinc-800">¥</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={priceInputValue}
                  min="1"
                  step={PRICE_STEP}
                  onFocus={(e) => {
                    setPriceDraft(priceInputValue);
                    e.currentTarget.select();
                  }}
                  onChange={(e) => setPriceDraft(e.target.value)}
                  onBlur={commitPriceDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-24 h-9 font-semibold text-zinc-800 text-right"
                />
              </div>
            ) : (
              <span className="font-semibold text-zinc-800">{formatYen(sellingPrice)}</span>
            )}
          </div>
          {canEdit && (
            <Slider
              // 0は販売価格として不正（サーバーが弾く）ため最小を1ステップにする
              value={[Math.min(Math.max(sellingPrice, PRICE_STEP), priceMax)]}
              min={PRICE_STEP}
              max={priceMax}
              step={PRICE_STEP}
              onValueChange={(v) => handlePriceChange(v[0], false)}
              onValueCommit={(v) => handlePriceChange(v[0], true)}
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">原価（1個）</span>
          <span className="font-semibold text-zinc-800">
            {hasCost ? formatYen(cost.totalCost) : "—"}
          </span>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex items-center justify-between">
          <span className="text-sm text-zinc-500">利益（1個）</span>
          <span className={`font-bold text-xl ${style.text}`}>
            {hasCost ? formatYen(cost.profit) : "—"}
          </span>
        </div>

        <div className="flex flex-col gap-2 bg-zinc-50 rounded-xl py-3 px-3">
          {hasCost ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-3xl font-bold ${style.text}`}>
                  {Math.round(cost.profitRate)}%
                </span>
                <span className={`text-sm flex items-center gap-1 ${style.text}`}>
                  {style.Icon && <style.Icon className="w-4 h-4" />}
                  {style.label}
                </span>
              </div>
              {/* 利益率の視覚バー */}
              <div className="h-2 rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    cost.profitRate >= 0 ? "bg-green-500" : "bg-red-500"
                  }`}
                  style={{ width: `${cost.profitRate >= 0 ? barWidth : 4}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-zinc-400 text-center">
              材料を追加すると利益率がわかります
            </span>
          )}
        </div>

        {recipe.servings > 1 && hasCost && (
          <p className="text-xs text-zinc-400 text-center">
            {recipe.servings}個作ると利益は約 {formatYen(cost.profit * recipe.servings)}
          </p>
        )}
      </section>

      {/* 材料 */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-zinc-700 px-1">材料（1個分）</h2>
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
          <p className="text-sm text-zinc-400 text-center py-4">材料が登録されていません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cost.lines.map((line) => (
              <li
                key={line.ingredientId}
                className="bg-white rounded-xl border border-zinc-200 px-3 py-3 flex items-center justify-between gap-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-800 truncate">{line.ingredientName}</span>
                  <span className="text-xs text-zinc-500">{line.quantityUsed}{line.unit}</span>
                </div>
                <span className="text-sm text-zinc-600 shrink-0">{formatYen(line.lineCost)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
