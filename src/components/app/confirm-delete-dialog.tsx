"use client";

import { ConfirmDialog } from "@/components/app/confirm-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 確認メッセージ（複数行可）
  message: React.ReactNode;
  title?: string;
  // 削除実行ボタンの待機状態
  isPending: boolean;
  onConfirm: () => void;
};

// 「本当に削除しますか？」の確認ダイアログ。
// スワイプ削除・編集ダイアログなど複数箇所から共用する。
// 見た目・挙動は ConfirmDialog と共通で、削除向けの文言だけをここが決める。
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  message,
  title = "削除の確認",
  isPending,
  onConfirm,
}: Props) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      message={message}
      confirmLabel="削除する"
      pendingLabel="削除中…"
      variant="destructive"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
