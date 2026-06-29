"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

// 「本当に削除しますか？」をモーダルで確認するダイアログ。
// スワイプ削除・編集ダイアログなど複数箇所から共用する。
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  message,
  title = "削除の確認",
  isPending,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[86vw] max-w-xs rounded-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            キャンセル
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
            className="flex-1"
          >
            {isPending ? "削除中…" : "削除する"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
