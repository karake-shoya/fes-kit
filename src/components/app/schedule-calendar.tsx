"use client";

import { useState } from "react";
import { ja } from "date-fns/locale";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { ymdToDate, dateToYmd } from "@/lib/schedule";
import { useScheduleMonth } from "@/components/app/schedule-month";
import type { DayButton } from "react-day-picker";

type Props = {
  // 開始日(YYYY-MM-DD) -> その日の件数
  taskCounts: Map<string, number>;
  // イベント当日（YYYY-MM-DD / なければ null）
  eventDate: string | null;
  onSelectDay: (ymd: string) => void;
};

export function ScheduleCalendar({ taskCounts, eventDate, onSelectDay }: Props) {
  // 表示月はヘッダーの「今月」ボタンと共有する
  const { month, setMonth } = useScheduleMonth();
  // タップした日をハイライトする（ボトムシートが開くまでの視覚フィードバック用）
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  const eventDateObj = eventDate ? ymdToDate(eventDate) : undefined;

  // 日付タップでその日の予定をボトムシートに表示
  function handleSelect(date: Date | undefined) {
    if (!date) return;
    setSelected(date);
    onSelectDay(dateToYmd(date));
  }

  return (
    <div className="flex flex-col gap-2">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={handleSelect}
        locale={ja}
        month={month}
        onMonthChange={setMonth}
        modifiers={{
          eventDay: eventDateObj ? [eventDateObj] : [],
        }}
        modifiersClassNames={{
          // イベント当日: オレンジのリングで強調
          eventDay: "ring-2 ring-orange-400 rounded-full font-bold text-orange-600",
        }}
        classNames={{ root: "w-full" }}
        components={{
          DayButton: (props) => <ScheduleDayButton {...props} taskCounts={taskCounts} />,
        }}
        style={{ "--cell-size": "3.25rem" } as React.CSSProperties}
        className="w-full rounded-2xl border border-border bg-card"
      />
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-medium leading-none text-primary-foreground">
            2
          </span>
          予定あり
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

// 日付ボタン本体は共有コンポーネントのまま使い、件数バッジだけを重ねて表示する
function ScheduleDayButton({
  taskCounts,
  ...props
}: React.ComponentProps<typeof DayButton> & { taskCounts: Map<string, number> }) {
  const count = taskCounts.get(dateToYmd(props.day.date)) ?? 0;
  return (
    <div className="relative">
      <CalendarDayButton {...props} />
      {count > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-medium leading-none text-primary-foreground"
        >
          {count}
        </span>
      )}
    </div>
  );
}
