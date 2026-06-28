"use client";

import { useState } from "react";
import { ja } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { ymdToDate, dateToYmd } from "@/lib/schedule";
import { useScheduleMonth } from "@/components/app/schedule-month";

type Props = {
  // タスクが存在する日（YYYY-MM-DD）
  taskDates: string[];
  // イベント当日（YYYY-MM-DD / なければ null）
  eventDate: string | null;
};

export function ScheduleCalendar({ taskDates, eventDate }: Props) {
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  // 表示月はヘッダーの「今月」ボタンと共有する
  const { month, setMonth } = useScheduleMonth();

  const taskDateObjs = taskDates.map(ymdToDate);
  const eventDateObj = eventDate ? ymdToDate(eventDate) : undefined;

  // 日付タップでその日のタスクカードへスクロール
  function handleSelect(date: Date | undefined) {
    setSelected(date);
    if (!date) return;
    document.getElementById(`day-${dateToYmd(date)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={handleSelect}
        locale={ja}
        month={month}
        onMonthChange={setMonth}
        modifiers={{
          hasTask:  taskDateObjs,
          eventDay: eventDateObj ? [eventDateObj] : [],
        }}
        modifiersClassNames={{
          // タスクがある日: 下部にオレンジ寄りのドット
          hasTask:
            "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-amber-500 after:content-['']",
          // イベント当日: オレンジのリングで強調
          eventDay: "ring-2 ring-orange-400 rounded-full font-bold text-orange-600",
        }}
        className="rounded-2xl border border-zinc-200 bg-white"
      />
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 予定あり
        </span>
        {eventDate && (
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-orange-400" /> イベント当日
          </span>
        )}
      </div>
    </div>
  );
}
