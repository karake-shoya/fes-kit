"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { setRecipeIngredient, removeRecipeIngredient } from "@/actions/recipe";
import { IngredientDialog } from "@/components/app/ingredient-dialog";
import { SelectModal } from "@/components/app/select-modal";
import { useKeyedDebounce } from "@/lib/use-keyed-debounce";
import { formatYen } from "@/lib/format";
import {
  unitCostOf,
  quantityFromLineCost,
  round1,
  round2,
  roundUpTo,
  type RecipeCostRow,
} from "@/lib/recipe-cost";
import type { Ingredient } from "@/db/schema";

type Mode = "qty" | "cost";

type Props = {
  recipeId:  string;
  projectId: string;
  lines:     RecipeCostRow[];             // 親（パネル）が持つ現在の材料行
  allIngredients: Ingredient[];           // プロジェクトの全材料（選択候補）
  // 親stateの即時更新（スライダー追従で利益率を再計算するため）
  onUpdateQuantity: (ingredientId: string, quantityUsed: number) => void;
  onAddLine:        (line: RecipeCostRow) => void;
  onRemoveLine:     (ingredientId: string) => void;
};

const COST_STEP = 5; // 材料費モードのスライダー/ステッパー刻み（円）

const MIN_QTY = 0.1; // 使用量の最小単位（小数第一位まで）

// 使用量を見やすく整形（整数はそのまま、端数は小数1桁）
const formatQty = (n: number) => (Number.isInteger(n) ? String(n) : String(round1(n)));

// 単位ごとのスライダー刻み（数字が苦手なペルソナ向けの粗めの目盛り）
function stepForUnit(unit: string): number {
  if (unit === "kg" || unit === "L") return 0.1;
  if (unit === "g" || unit === "ml") return 5;
  return 1; // 個・枚・本・袋など
}
// 単位ごとのスライダー上限（固定値）。
// 使用量に依存させると、右へ動かすほど上限が伸びて値が跳ね上がるため固定する。
// 上限を超える値は数値入力欄で直接指定できる。
function qtySliderMax(unit: string): number {
  if (unit === "kg" || unit === "L") return 10;
  if (unit === "g" || unit === "ml") return 1000;
  return 100; // 個・枚・本・袋など
}
// 材料追加時の初期使用量
function defaultQuantityForUnit(unit: string): number {
  if (unit === "g" || unit === "ml") return 50;
  return 1;
}

export function RecipeIngredientEditor({
  recipeId,
  projectId,
  lines,
  allIngredients,
  onUpdateQuantity,
  onAddLine,
  onRemoveLine,
}: Props) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // 材料ごとの編集モード（量で調整 / 材料費で調整）
  const [modes, setModes] = useState<Record<string, Mode>>({});
  // 外す操作は誤タップ防止のため2段階（×→確認）
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  // 数値入力の編集中バッファ（フォーカス中の1行のみ）。確定（blur/Enter）で適用
  const [draft, setDraft] = useState<{ id: string; mode: Mode; value: string } | null>(null);

  const [scheduleSave, cancelSave] = useKeyedDebounce(500);

  // 材料マスタの全情報をid引きできるようにする（編集ダイアログへ渡す用）
  const ingById = useMemo(
    () => new Map(allIngredients.map((i) => [i.id, i])),
    [allIngredients]
  );

  // 既に登録済みの材料は追加候補から除外
  const usedIds = useMemo(() => new Set(lines.map((l) => l.ingredientId)), [lines]);
  const available = useMemo(
    () => allIngredients.filter((ing) => !usedIds.has(ing.id)),
    [allIngredients, usedIds]
  );
  const ingredientOptions = useMemo(
    () =>
      available.map((ing) => ({
        id:        ing.id,
        primary:   ing.name,
        secondary: `${ing.quantity}${ing.unit}で${formatYen(ing.price)}`,
      })),
    [available]
  );

  // 使用量をサーバーへ保存（デバウンス）。失敗時はエラー表示のみ（state は親が保持）
  function saveQuantity(ingredientId: string, quantityUsed: number) {
    scheduleSave(ingredientId, () => {
      startTransition(async () => {
        try {
          await setRecipeIngredient(recipeId, projectId, ingredientId, String(quantityUsed));
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "保存に失敗しました");
        }
      });
    });
  }

  // スライダー/ステッパーの生値（mode依存）を使用量に変換して反映する
  // persist=true のときだけサーバー保存（ドラッグ確定・ステッパー押下時）
  function applyValue(line: RecipeCostRow, mode: Mode, raw: number, persist: boolean) {
    const q =
      mode === "qty"
        ? raw
        : quantityFromLineCost(raw, line.pricePerUnit, line.quantityPerUnit);
    const safeQ = Math.max(round1(q), MIN_QTY); // 小数第一位・最小0.1（原価計算が壊れない範囲）
    onUpdateQuantity(line.ingredientId, safeQ);
    if (persist) saveQuantity(line.ingredientId, safeQ);
  }

  // 数値入力欄の確定（blur/Enter）。不正値は無視して元の値を維持
  function commitDraft(line: RecipeCostRow, mode: Mode) {
    if (!draft || draft.id !== line.ingredientId || draft.mode !== mode) return;
    const cleaned = draft.value.trim().replace(/,/g, "");
    const raw = Number(cleaned);
    setDraft(null);
    if (cleaned === "" || Number.isNaN(raw) || raw <= 0) return;
    applyValue(line, mode, raw, true);
  }

  // −/＋ ステッパー（dir: -1 or +1）
  function stepChange(line: RecipeCostRow, mode: Mode, lineCost: number, dir: number) {
    if (mode === "qty") {
      const next = Math.max(round1(line.quantityUsed + stepForUnit(line.unit) * dir), MIN_QTY);
      applyValue(line, "qty", next, true);
    } else {
      const next = Math.max(Math.round(lineCost + COST_STEP * dir), 1);
      applyValue(line, "cost", next, true);
    }
  }

  // 候補から材料を選んだら、初期使用量で即追加（その場でスライダー調整できる）
  function handlePick(ingredientId: string) {
    const ing = allIngredients.find((i) => i.id === ingredientId);
    if (!ing) return;
    const q = defaultQuantityForUnit(ing.unit);
    const line: RecipeCostRow = {
      ingredientId:    ing.id,
      ingredientName:  ing.name,
      unit:            ing.unit,
      pricePerUnit:    ing.price,
      quantityPerUnit: ing.quantity,
      quantityUsed:    q,
    };
    onAddLine(line);
    startTransition(async () => {
      try {
        await setRecipeIngredient(recipeId, projectId, ing.id, String(q));
        setError(null);
      } catch (err) {
        // 失敗したら追加を取り消す
        onRemoveLine(ing.id);
        setError(err instanceof Error ? err.message : "追加に失敗しました");
      }
    });
  }

  function handleRemove(ingredientId: string) {
    setConfirmRemoveId(null);
    // 保留中の使用量保存を取り消す（500ms後にupsertが走って材料が復活するのを防ぐ）
    cancelSave(ingredientId);
    onRemoveLine(ingredientId);
    startTransition(async () => {
      try {
        await removeRecipeIngredient(recipeId, projectId, ingredientId);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "削除に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-4">
          材料を追加すると原価がわかります
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((line) => {
            const lineCost = unitCostOf(line.pricePerUnit, line.quantityPerUnit) * line.quantityUsed;
            const mode = modes[line.ingredientId] ?? "qty";

            const qStep = stepForUnit(line.unit);
            // 上限は操作で変わらない固定値（量＝単位ごと定数 / 材料費＝購入単価ベース）
            const sliderMax =
              mode === "qty"
                ? qtySliderMax(line.unit)
                : Math.max(roundUpTo(line.pricePerUnit, COST_STEP), 50);
            const sliderStep = mode === "qty" ? qStep : COST_STEP;
            const sliderValue = mode === "qty" ? line.quantityUsed : round2(lineCost);

            // 従属表示（自動計算される側）
            const derivedText = mode === "qty" ? `≒ ${formatYen(lineCost)}` : `≒ ${formatQty(line.quantityUsed)} ${line.unit}`;

            // 数値入力欄の表示値（編集中はバッファ、それ以外は現在値）
            const isEditingThis = draft?.id === line.ingredientId && draft?.mode === mode;
            const inputValue = isEditingThis
              ? draft.value
              : mode === "qty"
                ? formatQty(line.quantityUsed)
                : String(Math.round(lineCost));

            return (
              <li
                key={line.ingredientId}
                className="bg-white rounded-2xl border border-zinc-200 px-3 py-3 flex flex-col gap-3 shadow-sm"
              >
                {/* ヘッダ：材料名＋登録時の単価/数量・編集/外すボタン */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-zinc-800 truncate">{line.ingredientName}</span>
                    <span className="text-xs text-zinc-500">
                      {formatQty(line.quantityPerUnit)}{line.unit}で{formatYen(line.pricePerUnit)}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {ingById.get(line.ingredientId) && (
                      <IngredientDialog
                        projectId={projectId}
                        ingredient={ingById.get(line.ingredientId)!}
                      >
                        <button
                          type="button"
                          className="text-zinc-300 hover:text-amber-700 p-1"
                          aria-label="材料の登録情報を編集"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </IngredientDialog>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(line.ingredientId)}
                      className="text-zinc-300 hover:text-red-500 p-1"
                      aria-label="この材料を外す"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {confirmRemoveId === line.ingredientId && (
                  <div className="flex items-center justify-between gap-2 bg-red-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-red-600">この材料を外しますか？</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-zinc-500"
                        onClick={() => setConfirmRemoveId(null)}
                      >
                        やめる
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-red-500 hover:bg-red-600 text-white"
                        onClick={() => handleRemove(line.ingredientId)}
                      >
                        外す
                      </Button>
                    </div>
                  </div>
                )}

                {/* モード切替トグル */}
                <div className="flex rounded-lg bg-zinc-100 p-0.5 text-xs">
                  {(["qty", "cost"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModes((prev) => ({ ...prev, [line.ingredientId]: m }))}
                      className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                        mode === m ? "bg-white text-amber-800 shadow-sm" : "text-zinc-500"
                      }`}
                    >
                      {m === "qty" ? "量で調整" : "材料費で調整"}
                    </button>
                  ))}
                </div>

                {/* 現在値（直接入力可）＋ 従属表示 */}
                <div className="flex items-end justify-between gap-2">
                  <div className="flex items-baseline gap-1">
                    {mode === "cost" && (
                      <span className="text-lg font-semibold text-zinc-800">¥</span>
                    )}
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={inputValue}
                      min={mode === "qty" ? String(MIN_QTY) : "1"}
                      step={mode === "qty" ? 0.1 : 1}
                      onFocus={(e) => {
                        setDraft({ id: line.ingredientId, mode, value: inputValue });
                        e.currentTarget.select();
                      }}
                      onChange={(e) =>
                        setDraft({ id: line.ingredientId, mode, value: e.target.value })
                      }
                      onBlur={() => commitDraft(line, mode)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className="w-24 h-9 text-lg font-semibold text-zinc-800"
                    />
                    {mode === "qty" && (
                      <span className="text-sm text-zinc-500">{line.unit}</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">{derivedText}</span>
                </div>

                {/* スライダー＋ステッパー */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepChange(line, mode, lineCost, -1)}
                    className="shrink-0 w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 active:scale-95"
                    aria-label="減らす"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <Slider
                    value={[Math.min(sliderValue, sliderMax)]}
                    min={0}
                    max={sliderMax}
                    step={sliderStep}
                    onValueChange={(v) => applyValue(line, mode, v[0], false)}
                    onValueCommit={(v) => applyValue(line, mode, v[0], true)}
                  />
                  <button
                    type="button"
                    onClick={() => stepChange(line, mode, lineCost, 1)}
                    className="shrink-0 w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 active:scale-95"
                    aria-label="増やす"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-2">
        {available.length > 0 && (
          <SelectModal
            value=""
            onChange={handlePick}
            options={ingredientOptions}
            placeholder="＋ 材料を選んで追加"
            title="材料を選ぶ"
          />
        )}

        {/* 材料マスタに無い食材を、このページから直接登録できる */}
        <IngredientDialog projectId={projectId}>
          <Button variant="ghost" className="text-amber-800 hover:bg-amber-50">
            <Plus className="w-4 h-4" /> 新しい材料を登録する
          </Button>
        </IngredientDialog>

        {available.length === 0 && allIngredients.length > 0 && (
          <p className="text-xs text-zinc-400 text-center">
            登録済みの材料はすべて追加済みです
          </p>
        )}
      </div>
    </div>
  );
}
