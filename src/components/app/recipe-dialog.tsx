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
import { createRecipe, updateRecipe, deleteRecipe } from "@/actions/recipe";
import { DeleteConfirmInline } from "@/components/app/delete-confirm-inline";
import type { Recipe } from "@/db/schema";

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  recipe?: Recipe;
  // 追加後に詳細ページへ遷移するか（一覧の「＋追加」では true）
  redirectOnCreate?: boolean;
  children: React.ReactNode;
};

export function RecipeDialog({ projectId, recipe, redirectOnCreate, children }: Props) {
  const isEdit = Boolean(recipe);
  const [open, setOpen]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition]      = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

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
        if (isEdit && recipe) {
          await updateRecipe(recipe.id, projectId, formData);
          setOpen(false);
          router.refresh();
        } else {
          const result = await createRecipe(projectId, formData);
          formRef.current?.reset();
          setOpen(false);
          if (redirectOnCreate) {
            router.push(`/projects/${projectId}/recipes/${result.recipeId}`);
          } else {
            router.refresh();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  function handleDelete() {
    if (!recipe) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteRecipe(recipe.id, projectId);
        setOpen(false);
        // 詳細ページから削除した場合は一覧へ戻す
        router.push(`/projects/${projectId}/recipes`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="w-[92vw] max-w-md rounded-2xl"
        // 編集時は開いた瞬間にキーボードが立ち上がらないよう自動フォーカスを無効化
        onOpenAutoFocus={(e) => {
          if (isEdit) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? "商品を編集" : "商品を追加"}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">商品名 <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              name="name"
              placeholder="例：焼きそば"
              defaultValue={recipe?.name ?? ""}
              required
              // 追加モードのみ自動フォーカス（編集モードはキーボードを出さない）
              autoFocus={!isEdit}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="sellingPrice">販売価格（円） <span className="text-red-500">*</span></Label>
              <Input
                id="sellingPrice"
                name="sellingPrice"
                type="number"
                inputMode="decimal"
                step="1"
                min="1"
                placeholder="300"
                defaultValue={recipe?.sellingPrice ?? ""}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="servings">作る予定数</Label>
              <Input
                id="servings"
                name="servings"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                placeholder="100"
                defaultValue={recipe?.servings ?? 1}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70 -mt-2">
            販売価格は「1個（1皿）あたり」の値段を入れてください。
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memo">メモ</Label>
            <Textarea
              id="memo"
              name="memo"
              placeholder="盛り付けやトッピングのメモなど"
              rows={2}
              defaultValue={recipe?.memo ?? ""}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            disabled={isPending}
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
              この商品を削除
            </Button>
          )}

          {isEdit && confirmDelete && (
            <DeleteConfirmInline
              message={<>この商品を削除しますか？<br />登録した材料の組み合わせも一緒に削除されます。</>}
              isPending={isPending}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={handleDelete}
            />
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
