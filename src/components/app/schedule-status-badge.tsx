"use client";

import { useOptimistic, useTransition } from "react";
import { cycleScheduleStatus } from "@/actions/schedule";
import { showToast } from "@/components/app/toast";
import { STATUS_STYLE, nextStatus, type ScheduleStatus } from "@/lib/schedule";

type Props = {
  scheduleId: string;
  projectId:  string;
  status:     ScheduleStatus;
  // editor 以上ならタップで状態を進められる
  canEdit:    boolean;
};

export function ScheduleStatusBadge({ scheduleId, projectId, status, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  // タップした瞬間に次の状態を見せる。サーバーの結果が返れば実際の値に置き換わり、
  // 失敗した場合は元の表示に戻る
  const [shown, setShown] = useOptimistic(status);
  const style = STATUS_STYLE[shown];

  function handleClick(e: React.MouseEvent) {
    // 親カードの編集ダイアログが開かないよう伝播を止める
    e.stopPropagation();
    e.preventDefault();
    if (!canEdit || isPending) return;
    startTransition(async () => {
      setShown(nextStatus(status));
      try {
        await cycleScheduleStatus(scheduleId, projectId);
      } catch {
        showToast("状態を保存できませんでした");
      }
    });
  }

  const className = `shrink-0 text-xs rounded-full px-2 py-0.5 border ${style.text} ${
    canEdit ? "cursor-pointer active:scale-95 transition-transform" : ""
  }`;

  if (!canEdit) {
    return <span className={className}>{style.label}</span>;
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={className}>
      {style.label}
    </button>
  );
}
