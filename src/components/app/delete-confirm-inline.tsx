"use client";

import { Button } from "@/components/ui/button";

type Props = {
  // 確認メッセージ（複数行可）
  message: React.ReactNode;
  // 削除実行ボタンの待機状態
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// ダイアログ内に表示する2段階削除の確認ブロック
// （材料・商品など複数のダイアログで共用）
export function DeleteConfirmInline({ message, isPending, onCancel, onConfirm }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-600">{message}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
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
    </div>
  );
}
