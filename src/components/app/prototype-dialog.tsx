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
import { createPrototype, updatePrototype, deletePrototype } from "@/actions/prototype";
import { DeleteConfirmInline } from "@/components/app/delete-confirm-inline";
import { RESULT_OPTIONS } from "@/lib/prototype";
import type { PrototypeWithRecipe } from "@/db/queries/prototypes";

type Props = {
  projectId: string;
  recipes: { id: string; name: string }[];
  // 指定があれば編集モード、なければ追加モード
  prototype?: PrototypeWithRecipe;
  children: React.ReactNode;
};

export function PrototypeDialog({ projectId, recipes, prototype, children }: Props) {
  const isEdit = Boolean(prototype);
  const isRecipeOrphaned = isEdit && prototype != null && !recipes.some((r) => r.id === prototype.recipeId);
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
        if (isEdit && prototype) {
          await updatePrototype(prototype.id, projectId, formData);
        } else {
          await createPrototype(projectId, formData);
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
    if (!prototype) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePrototype(prototype.id, projectId);
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
            {isEdit ? "試作記録を編集" : "試作記録を追加"}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recipeId">レシピ <span className="text-red-500">*</span></Label>
            <select
              id="recipeId"
              name="recipeId"
              defaultValue={prototype?.recipeId ?? ""}
              required
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="" disabled>レシピを選択してください</option>
              {isRecipeOrphaned && (
                <option value={prototype!.recipeId} disabled>(削除済みのレシピ)</option>
              )}
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="triedAt">試作日 <span className="text-red-500">*</span></Label>
            <Input
              id="triedAt"
              name="triedAt"
              type="date"
              defaultValue={prototype?.triedAt ?? ""}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="result">評価</Label>
            <select
              id="result"
              name="result"
              defaultValue={prototype?.result ?? "needs_improvement"}
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              {RESULT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memo">メモ</Label>
            <Textarea
              id="memo"
              name="memo"
              placeholder="味・見た目・改善点など"
              rows={3}
              defaultValue={prototype?.memo ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="imageUrl">写真URL</Label>
            <Input
              id="imageUrl"
              name="imageUrl"
              type="url"
              placeholder="https://example.com/photo.jpg"
              defaultValue={prototype?.imageUrl ?? ""}
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
              この記録を削除
            </Button>
          )}

          {isEdit && confirmDelete && (
            <DeleteConfirmInline
              message="この試作記録を削除しますか？"
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
