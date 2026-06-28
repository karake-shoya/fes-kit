"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cycleScheduleStatus } from "@/actions/schedule";
import { STATUS_STYLE, type ScheduleStatus } from "@/lib/schedule";

type Props = {
  scheduleId: string;
  projectId:  string;
  status:     ScheduleStatus;
  // editor 以上ならタップで状態を進められる
  canEdit:    boolean;
};

export function ScheduleStatusBadge({ scheduleId, projectId, status, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const style  = STATUS_STYLE[status];

  function handleClick(e: React.MouseEvent) {
    // 親カードの編集ダイアログが開かないよう伝播を止める
    e.stopPropagation();
    e.preventDefault();
    if (!canEdit || isPending) return;
    startTransition(async () => {
      try {
        await cycleScheduleStatus(scheduleId, projectId);
        router.refresh();
      } catch {
        // 失敗時は何もしない（次タップで再試行可能）
      }
    });
  }

  const className = `shrink-0 text-xs rounded-full px-2 py-0.5 border ${style.text} ${
    canEdit ? "cursor-pointer active:scale-95 transition-transform" : ""
  } ${isPending ? "opacity-50" : ""}`;

  if (!canEdit) {
    return <span className={className}>{style.label}</span>;
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={className}>
      {style.label}
    </button>
  );
}
