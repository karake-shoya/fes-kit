"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/app/confirm-delete-dialog";
import { showToast } from "@/components/app/toast";

// 左スワイプで現れる削除ボタンの幅(px)
const ACTION_WIDTH = 80;
// スワイプ／タップ／縦スクロールを判定する遊び(px)
const SLOP = 8;

type Props = {
  /** カードの中身（見た目は呼び出し元が持つ） */
  children: React.ReactNode;
  /** 削除の実行。確認ダイアログでOKされたときだけ呼ばれる */
  onDelete: () => Promise<void>;
  /** 削除ボタンの読み上げラベル（例：「この予定を削除」） */
  deleteAriaLabel: string;
  /** 確認ダイアログの本文 */
  confirmMessage: React.ReactNode;
  /**
   * 閉じた状態でも見せておく「奥に何かある」ヒント幅(px)。
   * 0 なら完全に隠れる（スケジュールは12pxだけ覗かせている）
   */
  hintWidth?: number;
  /** false（閲覧者）ならスワイプ削除なしでカードだけ表示する */
  enabled: boolean;
};

/**
 * 左スワイプで削除ボタンが現れるリストカード。
 * スケジュール・持ち物チェックリストで同じ操作感を共有するため、
 * タッチ処理・オフセット管理・削除確認をここに集約している。
 */
export function SwipeActionCard({
  children,
  onDelete,
  deleteAriaLabel,
  confirmMessage,
  hintWidth = 0,
  enabled,
}: Props) {
  // 前面カードの左方向オフセット（-hintWidth 〜 -ACTION_WIDTH）
  const closed = -hintWidth;
  const [offset, setOffset] = useState(closed);
  const [dragging, setDragging] = useState(false); // ドラッグ中はトランジションを切る
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // ジェスチャー用の一時値（再レンダリングを挟まず参照する）
  const startX = useRef(0);
  const startY = useRef(0);
  const baseOffset = useRef(closed);
  const axis = useRef<null | "h" | "v">(null);
  const moved = useRef(false);
  const offsetRef = useRef(closed);

  function setOffsetBoth(next: number) {
    offsetRef.current = next;
    setOffset(next);
  }

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    baseOffset.current = offsetRef.current;
    axis.current = null;
    moved.current = false;
    setDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // 最初に動いた方向で水平/垂直を確定（垂直なら縦スクロールに任せる）
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (axis.current !== "h") return;
    moved.current = true;
    // ヒントを見せ続けるため、右方向にも閉じた位置より内側には戻さない
    const next = Math.max(-ACTION_WIDTH, Math.min(closed, baseOffset.current + dx));
    setOffsetBoth(next);
  }

  function handleTouchEnd() {
    setDragging(false);
    if (axis.current === "h") {
      // 半分以上引いていれば開く、それ以外は閉じる
      setOffsetBoth(offsetRef.current <= -ACTION_WIDTH / 2 ? -ACTION_WIDTH : closed);
    }
    // 直後の click を抑止するためのフラグは次フレームで解除
    requestAnimationFrame(() => {
      moved.current = false;
    });
  }

  // 開いている／スワイプ直後はカード本体のタップ（編集など）を無効化し、代わりにカードを閉じる
  function handleFrontClickCapture(e: React.MouseEvent) {
    if (offsetRef.current !== closed || moved.current) {
      e.preventDefault();
      e.stopPropagation();
      setOffsetBoth(closed);
    }
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onDelete();
        setConfirmOpen(false);
        setOffsetBoth(closed);
        router.refresh();
      } catch {
        // モーダルは開いたままにして再試行できるようにし、失敗したことは伝える
        showToast("削除できませんでした");
      }
    });
  }

  // 閲覧者はスワイプ削除なし（シンプルにカードのみ）
  if (!enabled) {
    return <li className="flex">{children}</li>;
  }

  // 削除ボタンとして機能する状態まで引かれたか（ヒント表示中は押せない）
  const revealed = offset <= -ACTION_WIDTH / 2;

  return (
    <li className="relative overflow-hidden rounded-xl">
      {/* 背面の削除ボタン。半分以上引くと赤に切り替わり押せるようになる */}
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={() => revealed && setConfirmOpen(true)}
          aria-label={deleteAriaLabel}
          tabIndex={revealed ? 0 : -1}
          style={{ width: ACTION_WIDTH }}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150 ${
            revealed ? "bg-red-500 text-white active:bg-red-600" : "bg-muted text-transparent"
          }`}
        >
          <Trash2 className="w-5 h-5" />
          削除
        </button>
      </div>

      {/* 前面カード（スワイプで左へスライド） */}
      <div
        className={`relative flex ${dragging ? "" : "transition-transform duration-200"} touch-pan-y`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClickCapture={handleFrontClickCapture}
      >
        {children}
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        isPending={isPending}
        onConfirm={handleConfirm}
        message={confirmMessage}
      />
    </li>
  );
}
