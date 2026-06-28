"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from "@/actions/ingredient";
import type { Ingredient } from "@/db/schema";

// 単位入力の候補（datalist）
const UNIT_OPTIONS = ["g", "kg", "ml", "L", "個", "袋", "本", "枚", "玉", "パック", "箱"];

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  ingredient?: Ingredient;
  // トリガーに使う要素（カードや追加ボタンなど）
  children: React.ReactNode;
};

export function IngredientDialog({ projectId, ingredient, children }: Props) {
  const isEdit = Boolean(ingredient);
  const [open, setOpen]              = useState(false);
  const [error, setError]            = useState<string | null>(null);
  // 削除は誤タップ防止のため2段階（ボタン → 確認）にする
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

  // ダイアログを閉じたら確認状態・エラーをリセット
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setConfirmDelete(false);
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isEdit && ingredient) {
          await updateIngredient(ingredient.id, projectId, formData);
        } else {
          await createIngredient(projectId, formData);
          formRef.current?.reset();
        }
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  function handleDelete() {
    if (!ingredient) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteIngredient(ingredient.id, projectId);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[92vw] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? "材料を編集" : "材料を追加"}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">材料名 <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              name="name"
              placeholder="例：キャベツ"
              defaultValue={ingredient?.name ?? ""}
              required
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="price">単価（円） <span className="text-red-500">*</span></Label>
              <Input
                id="price"
                name="price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="198"
                defaultValue={ingredient?.price ?? ""}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="quantity">購入数量 <span className="text-red-500">*</span></Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="1000"
                defaultValue={ingredient?.quantity ?? ""}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit">単位 <span className="text-red-500">*</span></Label>
            <Input
              id="unit"
              name="unit"
              list="unit-options"
              placeholder="g / 袋 / 個 など"
              defaultValue={ingredient?.unit ?? ""}
              required
            />
            <datalist id="unit-options">
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <p className="text-xs text-zinc-400">
              「1000g入りを198円で買った」なら 単価=198 / 数量=1000 / 単位=g
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier">仕入れ先</Label>
            <Input
              id="supplier"
              name="supplier"
              placeholder="例：業務スーパー"
              defaultValue={ingredient?.supplier ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memo">メモ</Label>
            <Textarea
              id="memo"
              name="memo"
              placeholder="特売日や代替品など"
              rows={2}
              defaultValue={ingredient?.memo ?? ""}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            disabled={isPending}
            className="bg-amber-700 hover:bg-amber-800 text-white"
          >
            {isPending ? "保存中…" : isEdit ? "変更を保存" : "追加する"}
          </Button>

          {isEdit && !confirmDelete && (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirmDelete(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              この材料を削除
            </Button>
          )}

          {isEdit && confirmDelete && (
            <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">
                この材料を削除しますか？<br />
                この材料を使っているレシピの構成からも取り除かれます。
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1"
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleDelete}
                  className="flex-1"
                >
                  {isPending ? "削除中…" : "削除する"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
