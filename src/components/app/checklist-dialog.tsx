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
import { createChecklistItem, updateChecklistItem, deleteChecklistItem } from "@/actions/checklist";
import { ConfirmDeleteDialog } from "@/components/app/confirm-delete-dialog";
import { CATEGORY_ORDER, CATEGORY_STYLE } from "@/lib/checklist";
import type { ChecklistItem } from "@/db/schema";

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  item?: ChecklistItem;
  children: React.ReactNode;
};

export function ChecklistDialog({ projectId, item, children }: Props) {
  const isEdit = Boolean(item);
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
        if (isEdit && item) {
          await updateChecklistItem(item.id, projectId, formData);
        } else {
          await createChecklistItem(projectId, formData);
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
    if (!item) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteChecklistItem(item.id, projectId);
        // ネストした Dialog を同一フレームで同時に閉じると Radix の
        // スクロールロック解除が取りこぼされ画面が操作不能になることがある。
        // 内側（確認モーダル）→外側（編集ダイアログ）の順に閉じる。
        setConfirmDelete(false);
        setTimeout(() => {
          setOpen(false);
          router.refresh();
        }, 150);
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
        onOpenAutoFocus={isEdit ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? "持ち物を編集" : "持ち物を追加"}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">名前 <span className="text-red-500">*</span></Label>
            <Input
              id="label"
              name="label"
              placeholder="例：テント、軍手"
              defaultValue={item?.label ?? ""}
              required
              autoFocus={!isEdit}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">カテゴリ</Label>
            <select
              id="category"
              name="category"
              defaultValue={item?.category ?? "tool"}
              className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{CATEGORY_STYLE[c].label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            disabled={isPending}
          >
            {isPending ? "保存中…" : isEdit ? "変更を保存" : "追加する"}
          </Button>

          {isEdit && (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirmDelete(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              この持ち物を削除
            </Button>
          )}
        </form>
      </DialogContent>

      {isEdit && (
        <ConfirmDeleteDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          isPending={isPending}
          onConfirm={handleDelete}
          message={<>「{item?.label}」を削除します。<br />この操作は取り消せません。</>}
        />
      )}
    </Dialog>
  );
}
