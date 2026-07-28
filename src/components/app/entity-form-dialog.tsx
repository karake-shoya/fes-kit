"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/app/confirm-delete-dialog";
import { DeleteConfirmInline } from "@/components/app/delete-confirm-inline";
import type { EntityDialog, SubmitResult } from "@/lib/use-entity-dialog";

type DeleteConfig = {
  /** 削除ボタンの文言（例：「この材料を削除」） */
  label: string;
  /** 確認メッセージ */
  message: React.ReactNode;
  /**
   * 確認の見せ方。
   * inline = フォーム内に確認ブロックを開く / modal = 別ダイアログで確認する
   */
  confirmWith: "inline" | "modal";
  /** 削除の実行 */
  run: () => Promise<void>;
  /** 削除後に移動する画面（詳細ページから消したときに一覧へ戻すなど） */
  redirectTo?: string;
};

type Props = {
  /** useEntityDialog() の戻り値 */
  dialog: EntityDialog;
  /** 編集モードか（タイトル・ボタン文言・自動フォーカスの制御に使う） */
  isEdit: boolean;
  /** ダイアログのタイトル */
  title: string;
  /** ダイアログを開く要素（カード・追加ボタンなど） */
  trigger: React.ReactNode;
  /** 送信処理。戻り値でフォームのリセット・遷移先を指示できる */
  onSubmit: (formData: FormData) => Promise<SubmitResult>;
  /** 送信ボタンの文言（既定：追加する／変更を保存） */
  submitLabel?: string;
  /** 送信ボタンを押せなくする追加条件（写真アップロード中など） */
  submitDisabled?: boolean;
  /** 保存中の文言（既定：保存中…） */
  pendingLabel?: string;
  /** 編集モードのときだけ出す削除導線。不要なら省略する */
  onDelete?: DeleteConfig;
  /** フォームの入力項目 */
  children: React.ReactNode;
};

/**
 * 追加・編集ダイアログの共通シェル。
 * 開閉・保存中表示・エラー表示・2段階削除といった定型をここが持ち、
 * 各ダイアログはフォームの項目だけを書けば良いようにする。
 */
export function EntityFormDialog({
  dialog,
  isEdit,
  title,
  trigger,
  onSubmit,
  submitLabel,
  submitDisabled,
  pendingLabel = "保存中…",
  onDelete,
  children,
}: Props) {
  const { open, handleOpenChange, error, isPending, confirmDelete, setConfirmDelete, formRef } = dialog;
  const showDelete = isEdit && onDelete;

  function handleDelete() {
    if (!onDelete) return;
    dialog.remove(onDelete.run, {
      stagger: onDelete.confirmWith === "modal",
      redirectTo: onDelete.redirectTo,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="w-[92vw] max-w-md rounded-2xl"
        // 編集時は開いた瞬間に入力欄へフォーカスせず、スマホのキーボードが
        // 勝手に立ち上がるのを防ぐ（追加時は入力を促したいのでフォーカスする）
        onOpenAutoFocus={isEdit ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <form
          ref={formRef}
          onSubmit={(e) => dialog.submit(e, onSubmit)}
          className="flex flex-col gap-4 mt-2"
        >
          {children}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={isPending || submitDisabled}>
            {isPending
              ? pendingLabel
              : submitLabel ?? (isEdit ? "変更を保存" : "追加する")}
          </Button>

          {showDelete && !(onDelete.confirmWith === "inline" && confirmDelete) && (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirmDelete(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              {onDelete.label}
            </Button>
          )}

          {showDelete && onDelete.confirmWith === "inline" && confirmDelete && (
            <DeleteConfirmInline
              message={onDelete.message}
              isPending={isPending}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={handleDelete}
            />
          )}
        </form>
      </DialogContent>

      {showDelete && onDelete.confirmWith === "modal" && (
        <ConfirmDeleteDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          isPending={isPending}
          onConfirm={handleDelete}
          message={onDelete.message}
        />
      )}
    </Dialog>
  );
}
