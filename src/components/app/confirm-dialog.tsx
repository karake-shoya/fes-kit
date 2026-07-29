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
  title: string;
  // 確認メッセージ（複数行可）
  message: React.ReactNode;
  /** 実行ボタンの文言（例：「削除する」「これにする」） */
  confirmLabel: string;
  /** 実行中の文言（例：「削除中…」） */
  pendingLabel: string;
  /** 取り消せない操作は destructive（赤）にする */
  variant?: "default" | "destructive";
  isPending: boolean;
  onConfirm: () => void;
};

/**
 * 「本当に実行しますか？」をモーダルで確認するダイアログ。
 * 削除・パターンの本採用など、取り消せない操作の直前に挟む。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  pendingLabel,
  variant = "default",
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
            variant={variant}
            disabled={isPending}
            onClick={onConfirm}
            className="flex-1"
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
