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
import { createPrototypeUploadUrl } from "@/actions/upload";
import { resizeImage } from "@/lib/image";
import { DeleteConfirmInline } from "@/components/app/delete-confirm-inline";
import { SelectModal } from "@/components/app/select-modal";
import { RESULT_OPTIONS } from "@/lib/prototype";
import { ImagePlus, X } from "lucide-react";
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
  const [recipeId, setRecipeId]           = useState(prototype?.recipeId ?? "");
  // 写真は選択時にR2へ直接アップロードし、確定後のURLを保持する
  const [imageUrl, setImageUrl]           = useState<string | null>(prototype?.imageUrl ?? null);
  const [uploading, setUploading]         = useState(false);
  const [isPending, startTransition]      = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router  = useRouter();

  // レシピ選択モーダル用の選択肢
  const recipeOptions = recipes.map((r) => ({ id: r.id, primary: r.name }));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setConfirmDelete(false);
      setError(null);
      // 閉じたら未保存の選択を破棄（編集モードは元の値、追加モードは初期値へ）
      setRecipeId(prototype?.recipeId ?? "");
      setImageUrl(prototype?.imageUrl ?? null);
    }
  }

  // 写真選択 → 縮小 → 署名付きURL取得 → R2へ直接PUT
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await resizeImage(file);
      const { uploadUrl, publicUrl } = await createPrototypeUploadUrl(projectId);
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!res.ok) throw new Error("写真のアップロードに失敗しました");
      setImageUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "写真のアップロードに失敗しました");
    } finally {
      setUploading(false);
      // 同じファイルを再選択できるようリセット
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!recipeId) {
      setError("レシピを選んでください");
      return;
    }
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isEdit && prototype) {
          await updatePrototype(prototype.id, projectId, formData);
        } else {
          await createPrototype(projectId, formData);
          formRef.current?.reset();
          setRecipeId("");
          setImageUrl(null);
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
            <Label>レシピ <span className="text-red-500">*</span></Label>
            <input type="hidden" name="recipeId" value={recipeId} />
            <SelectModal
              value={recipeId}
              onChange={setRecipeId}
              options={recipeOptions}
              placeholder="レシピを選ぶ"
              title="レシピを選ぶ"
              emptyText="先にレシピを登録してください"
              fallbackLabel={isRecipeOrphaned ? "(削除済みのレシピ)" : undefined}
            />
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
              className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            <Label>写真</Label>
            {/* 保存対象のURL（R2へのアップロード成功時にセット） */}
            <input type="hidden" name="imageUrl" value={imageUrl ?? ""} />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {imageUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="試作写真のプレビュー"
                  className="w-full rounded-xl object-cover max-h-56"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  disabled={uploading || isPending}
                  aria-label="写真を削除"
                  className="absolute top-2 right-2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || isPending}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background py-8 text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                <ImagePlus className="w-6 h-6" />
                <span className="text-sm">{uploading ? "アップロード中…" : "写真を選ぶ"}</span>
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            disabled={isPending || uploading}
          >
            {isPending ? "保存中…" : uploading ? "写真を処理中…" : isEdit ? "変更を保存" : "追加する"}
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
