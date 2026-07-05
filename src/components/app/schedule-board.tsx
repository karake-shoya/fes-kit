"use client";

import { useState } from "react";
import { isSameMonth } from "date-fns";
import { CalendarDays, ListTodo } from "lucide-react";
import { ScheduleCalendar } from "@/components/app/schedule-calendar";
import { ScheduleCard } from "@/components/app/schedule-card";
import { ScheduleDayModal } from "@/components/app/schedule-day-modal";
import { EventDayBadge } from "@/components/app/schedule-day-heading";
import { useScheduleMonth } from "@/components/app/schedule-month";
import {
  STATUS_STYLE,
  EVENT_DAY_STYLE,
  formatDayHeading,
  ymdToDate,
  countSchedulesByDay,
  groupSchedulesByDay,
  groupSchedulesByStatus,
} from "@/lib/schedule";
import type { Schedule } from "@/db/schema";

type Props = {
  projectId: string;
  eventDate: string | null;
  canEdit: boolean;
  schedules: Schedule[];
};

type Tab = "calendar" | "list";
type ListGroupBy = "day" | "status";

export function ScheduleBoard({ projectId, eventDate, canEdit, schedules }: Props) {
  const [tab, setTab] = useState<Tab>("calendar");
  const [listGroupBy, setListGroupBy] = useState<ListGroupBy>("day");
  // 日付タップで開くボトムシートの対象日（YYYY-MM-DD）
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // カレンダーで表示中の月（ヘッダーの「今月」ボタンと共有）
  const { month } = useScheduleMonth();

  // カレンダーの件数バッジ用: 全タスクを開始日ごとに集計
  const taskCounts = countSchedulesByDay(schedules);

  // カレンダータブ: 表示中の月（開始日基準）のタスクのみ（空状態判定に使用）
  const monthly = schedules.filter((s) => isSameMonth(ymdToDate(s.startDate), month));

  // ボトムシートに表示する、選択中の日の予定
  const selectedDaySchedules = selectedDay
    ? schedules.filter((s) => s.startDate === selectedDay)
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* ビュー切り替えタブ */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")}>
          <CalendarDays className="w-4 h-4" /> カレンダー
        </TabButton>
        <TabButton active={tab === "list"} onClick={() => setTab("list")}>
          <ListTodo className="w-4 h-4" /> 一覧
        </TabButton>
      </div>

      {tab === "calendar" ? (
        <div className="flex flex-col gap-6">
          <ScheduleCalendar taskCounts={taskCounts} eventDate={eventDate} onSelectDay={setSelectedDay} />
          {monthly.length === 0 && (
            <EmptyState>
              <CalendarDays className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                この月の予定はありません。<br />
                月を切り替えるか「追加」で登録しましょう。
              </p>
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* グループ方法の切り替え */}
          <div className="flex items-center gap-1 self-end rounded-lg bg-muted p-0.5 text-xs">
            <SubToggle active={listGroupBy === "day"} onClick={() => setListGroupBy("day")}>
              日付順
            </SubToggle>
            <SubToggle active={listGroupBy === "status"} onClick={() => setListGroupBy("status")}>
              ステータス別
            </SubToggle>
          </div>

          {schedules.length === 0 ? (
            <EmptyState>
              <CalendarDays className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                まだ予定がありません。<br />
                {canEdit
                  ? "「追加」ボタンで準備や当日の予定を登録しましょう！"
                  : "編集者が予定を登録するとここに表示されます。"}
              </p>
            </EmptyState>
          ) : listGroupBy === "day" ? (
            <DayGroups groups={groupSchedulesByDay(schedules)} eventDate={eventDate} projectId={projectId} canEdit={canEdit} />
          ) : (
            <StatusGroups groups={groupSchedulesByStatus(schedules)} projectId={projectId} canEdit={canEdit} />
          )}
        </div>
      )}

      <ScheduleDayModal
        ymd={selectedDay}
        onClose={() => setSelectedDay(null)}
        schedules={selectedDaySchedules}
        eventDate={eventDate}
        projectId={projectId}
        canEdit={canEdit}
      />
    </div>
  );
}

// --- 内部コンポーネント -------------------------------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
        active ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SubToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 font-medium transition-colors ${
        active ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 py-12 text-center">{children}</div>;
}

// 日付順グループの描画
function DayGroups({
  groups,
  eventDate,
  projectId,
  canEdit,
}: {
  groups: [string, Schedule[]][];
  eventDate: string | null;
  projectId: string;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map(([day, items]) => {
        const isEventDay = eventDate === day;
        return (
          <section key={day} id={`day-${day}`} className="flex flex-col gap-2 scroll-mt-4">
            <h2 className={`text-sm font-semibold px-1 ${isEventDay ? EVENT_DAY_STYLE.text : "text-muted-foreground"}`}>
              {formatDayHeading(day)}
              {isEventDay && <EventDayBadge />}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((s) => (
                <ScheduleCard key={s.id} schedule={s} projectId={projectId} canEdit={canEdit} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ステータス別グループの描画
function StatusGroups({
  groups,
  projectId,
  canEdit,
}: {
  groups: [keyof typeof STATUS_STYLE, Schedule[]][];
  projectId: string;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map(([status, items]) => (
        <section key={status} className="flex flex-col gap-2">
          <h2 className={`text-sm font-semibold px-1 ${STATUS_STYLE[status].text}`}>
            {STATUS_STYLE[status].label}
            <span className="ml-1 text-xs text-muted-foreground/70">{items.length}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {items.map((s) => (
              <ScheduleCard key={s.id} schedule={s} projectId={projectId} canEdit={canEdit} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
