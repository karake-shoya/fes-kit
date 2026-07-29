"use client";

import { ScheduleDialog } from "@/components/app/schedule-dialog";
import { ScheduleStatusBadge } from "@/components/app/schedule-status-badge";
import { SwipeActionCard } from "@/components/app/swipe-action-card";
import { deleteSchedule } from "@/actions/schedule";
import { STATUS_STYLE, formatDateRange } from "@/lib/schedule";
import type { Schedule } from "@/db/schema";

type Props = {
  schedule: Schedule;
  projectId: string;
  // editor 以上なら編集ダイアログ・ステータス切り替え・スワイプ削除が使える
  canEdit: boolean;
};

// 閉じた状態でも12pxだけ削除ボタンを覗かせ、「引ける」ことを気づかせる
const HINT_WIDTH = 12;

// タスク1件分のカード。日付順・ステータス別どちらのグループからも再利用する。
export function ScheduleCard({ schedule: s, projectId, canEdit }: Props) {
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

  return (
    <SwipeActionCard
      enabled={canEdit}
      hintWidth={HINT_WIDTH}
      deleteAriaLabel="この予定を削除"
      confirmMessage={<>「{s.title}」を削除します。<br />この操作は取り消せません。</>}
      onDelete={() => deleteSchedule(s.id, projectId)}
    >
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
    </SwipeActionCard>
  );
}
