"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleCard } from "@/components/app/schedule-card";
import { EventDayBadge } from "@/components/app/schedule-day-heading";
import { formatDayHeading, EVENT_DAY_STYLE } from "@/lib/schedule";
import type { Schedule } from "@/db/schema";

type Props = {
  // 開いている日付（YYYY-MM-DD）。null なら閉じている
  ymd: string | null;
  onClose: () => void;
  schedules: Schedule[];
  eventDate: string | null;
  projectId: string;
  canEdit: boolean;
};

// 日付タップで開く、その日の予定だけを見せるボトムシート
export function ScheduleDayModal({ ymd, onClose, schedules, eventDate, projectId, canEdit }: Props) {
  // 閉じるアニメーション中も表示内容を保持する（ymd が null になっても直前の内容を出し続ける）
  const [shown, setShown] = useState({ ymd, schedules, eventDate });
  if (ymd !== null && (ymd !== shown.ymd || schedules !== shown.schedules || eventDate !== shown.eventDate)) {
    setShown({ ymd, schedules, eventDate });
  }

  const isEventDay = shown.ymd !== null && shown.eventDate === shown.ymd;

  return (
    <Dialog open={ymd !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="fixed inset-x-0 bottom-0 top-auto left-0 max-w-full translate-x-0 translate-y-0 gap-4 rounded-t-3xl rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-full max-h-[75vh] overflow-y-auto data-open:slide-in-from-bottom data-open:zoom-in-100 data-closed:slide-out-to-bottom data-closed:zoom-out-100"
      >
        {shown.ymd && (
          <>
            <DialogHeader>
              <DialogTitle className={`text-base font-semibold ${isEventDay ? EVENT_DAY_STYLE.text : ""}`}>
                {formatDayHeading(shown.ymd)}
                {isEventDay && <EventDayBadge />}
              </DialogTitle>
            </DialogHeader>
            {shown.schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">この日の予定はありません。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {shown.schedules.map((s) => (
                  <ScheduleCard key={s.id} schedule={s} projectId={projectId} canEdit={canEdit} />
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
