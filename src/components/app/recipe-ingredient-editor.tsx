"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setRecipeIngredient, removeRecipeIngredient } from "@/actions/recipe";
import { IngredientDialog } from "@/components/app/ingredient-dialog";
import { formatYen } from "@/lib/format";
import type { Ingredient } from "@/db/schema";

// 詳細ページで使う材料行（原価計算済み）
type Line = {
  ingredientId:   string;
  ingredientName: string;
  unit:           string;
  quantityUsed:   number;
  lineCost:       number;
};

type Props = {
  recipeId:  string;
  projectId: string;
  lines:     Line[];           // 現在レシピに登録済みの材料
  allIngredients: Ingredient[]; // プロジェクトの全材料（選択候補）
};

export function RecipeIngredientEditor({
  recipeId,
  projectId,
  lines,
  allIngredients,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 追加ダイアログの状態
  const [addOpen, setAddOpen]               = useState(false);
  const [selectedId, setSelectedId]         = useState("");
  const [quantity, setQuantity]             = useState("");

  // 編集ダイアログの状態（対象材料）
  const [editLine, setEditLine]             = useState<Line | null>(null);
  const [editQuantity, setEditQuantity]     = useState("");

  // 既に登録済みの材料は追加候補から除外
  const usedIds = useMemo(() => new Set(lines.map((l) => l.ingredientId)), [lines]);
  const available = useMemo(
    () => allIngredients.filter((ing) => !usedIds.has(ing.id)),
    [allIngredients, usedIds]
  );

  function handleAdd() {
    setError(null);
    if (!selectedId) {
      setError("材料を選んでください");
      return;
    }
    startTransition(async () => {
      try {
        await setRecipeIngredient(recipeId, projectId, selectedId, quantity);
        setAddOpen(false);
        setSelectedId("");
        setQuantity("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  function handleEditSave() {
    if (!editLine) return;
    setError(null);
    startTransition(async () => {
      try {
        await setRecipeIngredient(recipeId, projectId, editLine.ingredientId, editQuantity);
        setEditLine(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  function handleRemove(ingredientId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeRecipeIngredient(recipeId, projectId, ingredientId);
        setEditLine(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  const selectedIngredient = allIngredients.find((i) => i.id === selectedId);

  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-4">
          材料を追加すると原価がわかります
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.ingredientId}>
              <button
                type="button"
                onClick={() => {
                  setEditLine(line);
                  setEditQuantity(String(line.quantityUsed));
                  setError(null);
                }}
                className="w-full text-left bg-white rounded-xl border border-zinc-200 px-3 py-3 flex items-center justify-between gap-2 active:scale-[0.99] transition-transform"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-800 truncate">{line.ingredientName}</span>
                  <span className="text-xs text-zinc-500">{line.quantityUsed}{line.unit}</span>
                </div>
                <span className="text-sm text-zinc-600 shrink-0">{formatYen(line.lineCost)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && !addOpen && !editLine && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="flex flex-col gap-2">
        {available.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              setAddOpen(true);
              setError(null);
            }}
            className="border-amber-300 text-amber-800 hover:bg-amber-50"
          >
            ＋ 材料を追加
          </Button>
        )}

        {/* 材料マスタに無い食材を、このページから直接登録できる */}
        <IngredientDialog projectId={projectId}>
          <Button
            variant="ghost"
            className="text-amber-800 hover:bg-amber-50"
          >
            ＋ 新しい材料を登録する
          </Button>
        </IngredientDialog>

        {available.length === 0 && allIngredients.length > 0 && (
          <p className="text-xs text-zinc-400 text-center">
            登録済みの材料はすべて追加済みです
          </p>
        )}
      </div>

      {/* 材料追加ダイアログ */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setError(null); }}>
        <DialogContent className="w-[92vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">材料を追加</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ingredient-select">材料 <span className="text-red-500">*</span></Label>
              <select
                id="ingredient-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <option value="">選んでください</option>
                {available.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}（{ing.quantity}{ing.unit}で{formatYen(ing.price)}）
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-quantity">
                使用量（商品1個分） <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="add-quantity"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="30"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <span className="text-sm text-zinc-500 shrink-0 w-10">
                  {selectedIngredient?.unit ?? ""}
                </span>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              onClick={handleAdd}
              disabled={isPending}
              className="bg-amber-700 hover:bg-amber-800 text-white"
            >
              {isPending ? "追加中…" : "追加する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 材料の使用量編集ダイアログ */}
      <Dialog open={editLine !== null} onOpenChange={(o) => { if (!o) { setEditLine(null); setError(null); } }}>
        <DialogContent className="w-[92vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editLine?.ingredientName} の使用量
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-quantity">
                使用量（商品1個分） <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-quantity"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                />
                <span className="text-sm text-zinc-500 shrink-0 w-10">
                  {editLine?.unit ?? ""}
                </span>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              onClick={handleEditSave}
              disabled={isPending}
              className="bg-amber-700 hover:bg-amber-800 text-white"
            >
              {isPending ? "保存中…" : "変更を保存"}
            </Button>
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => editLine && handleRemove(editLine.ingredientId)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              この材料を外す
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
