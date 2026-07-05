"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ScheduleDialog } from "@/components/app/schedule-dialog";
import { ScheduleStatusBadge } from "@/components/app/schedule-status-badge";
import { ConfirmDeleteDialog } from "@/components/app/confirm-delete-dialog";
import { deleteSchedule } from "@/actions/schedule";
import { STATUS_STYLE, formatDateRange } from "@/lib/schedule";
import type { Schedule } from "@/db/schema";

type Props = {
  schedule: Schedule;
  projectId: string;
  // editor 以上なら編集ダイアログ・ステータス切り替え・スワイプ削除が使える
  canEdit: boolean;
};

// 左スワイプで現れる削除ボタンの幅(px)
const ACTION_WIDTH = 80;
// スワイプ／タップ／縦スクロールを判定する遊び(px)
const SLOP = 8;
// 常時わずかに見せる「奥に何かある」ヒント幅(px)。閉じた状態はここが基準になる
const HINT_WIDTH = 12;

// タスク1件分のカード。日付順・ステータス別どちらのグループからも再利用する。
export function ScheduleCard({ schedule: s, projectId, canEdit }: Props) {
  const [offset, setOffset] = useState(-HINT_WIDTH); // 前面カードの左方向オフセット（-HINT_WIDTH 〜 -ACTION_WIDTH）
  const [dragging, setDragging] = useState(false); // ドラッグ中はトランジションを切る
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // ジェスチャー用の一時値（再レンダリングを挟まず参照する）
  const startX = useRef(0);
  const startY = useRef(0);
  const baseOffset = useRef(0);
  const axis = useRef<null | "h" | "v">(null);
  const moved = useRef(false);
  const offsetRef = useRef(-HINT_WIDTH);

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
    // 常時ヒントを見せ続けるため、右方向にも -HINT_WIDTH より内側には戻さない
    const next = Math.max(-ACTION_WIDTH, Math.min(-HINT_WIDTH, baseOffset.current + dx));
    setOffsetBoth(next);
  }

  function handleTouchEnd() {
    setDragging(false);
    if (axis.current === "h") {
      // 半分以上引いていれば開く、それ以外はヒント位置に戻す
      setOffsetBoth(offsetRef.current <= -ACTION_WIDTH / 2 ? -ACTION_WIDTH : -HINT_WIDTH);
    }
    // 直後の click を抑止するためのフラグは次フレームで解除
    requestAnimationFrame(() => {
      moved.current = false;
    });
  }

  // 開いている／スワイプ直後はカード本体のタップ（編集・ステータス）を無効化し、
  // 代わりにカードを閉じる
  function handleFrontClickCapture(e: React.MouseEvent) {
    if (offsetRef.current !== -HINT_WIDTH || moved.current) {
      e.preventDefault();
      e.stopPropagation();
      setOffsetBoth(-HINT_WIDTH);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteSchedule(s.id, projectId);
        setConfirmOpen(false);
        setOffsetBoth(-HINT_WIDTH);
        router.refresh();
      } catch {
        // 失敗時はモーダルを開いたまま（再試行可能）
      }
    });
  }

  // 左端バーは常にステータス色（当日ハイライトは見出し側で表現）
  const bar = STATUS_STYLE[s.status].bar;
  // タイトル＋日付の本文（編集トリガーになる部分）
  const body = (
    <div className="flex flex-col min-w-0">
      <span className="text-sm font-medium text-foreground truncate">{s.title}</span>
      <span className="text-xs text-muted-foreground/70">
        {formatDateRange(s.startDate, s.endDate)}
        {s.memo && <> ・ {s.memo}</>}
      </span>
    </div>
  );

  const cardInner = (
    <div className="flex flex-1 min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className={`w-1.5 shrink-0 ${bar}`} />
      <div className="flex items-center justify-between gap-2 px-3 py-3 flex-1 min-w-0">
        {canEdit ? (
          <ScheduleDialog projectId={projectId} schedule={s}>
            <button type="button" className="text-left min-w-0 flex-1 active:scale-[0.99] transition-transform">
              {body}
            </button>
          </ScheduleDialog>
        ) : (
          body
        )}
        <ScheduleStatusBadge
          scheduleId={s.id}
          projectId={projectId}
          status={s.status}
          canEdit={canEdit}
        />
      </div>
    </div>
  );

  // 閲覧者はスワイプ削除なし（シンプルにカードのみ）
  if (!canEdit) {
    return <li className="flex">{cardInner}</li>;
  }

  // ヒント表示中（軽く引かれているだけ）か、削除ボタンとして機能する状態まで引かれたか
  const revealed = offset <= -ACTION_WIDTH / 2;

  return (
    <li className="relative overflow-hidden rounded-xl">
      {/* 背面の削除ボタン。常に薄いヒントが覗いており、半分以上引くと赤に切り替わる */}
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={() => revealed && setConfirmOpen(true)}
          aria-label="この予定を削除"
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
        {cardInner}
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        isPending={isPending}
        onConfirm={handleDelete}
        message={<>「{s.title}」を削除します。<br />この操作は取り消せません。</>}
      />
    </li>
  );
}
