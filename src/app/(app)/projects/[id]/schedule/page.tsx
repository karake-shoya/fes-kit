import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Plus, PartyPopper } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getSchedules } from "@/db/queries/schedules";
import { getProjectMeta, getMyRole } from "@/db/queries/projects";
import { ScheduleDialog } from "@/components/app/schedule-dialog";
import { ScheduleCalendar } from "@/components/app/schedule-calendar";
import { ScheduleMonthProvider, TodayButton } from "@/components/app/schedule-month";
import { ScheduleStatusBadge } from "@/components/app/schedule-status-badge";
import { Button } from "@/components/ui/button";
import {
  STATUS_STYLE,
  STATUS_ORDER,
  EVENT_DAY_STYLE,
  formatDateRange,
  formatDayHeading,
} from "@/lib/schedule";
import type { Schedule } from "@/db/schema";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireAuth();

  const [myRole, list, project] = await Promise.all([
    getMyRole(id, userId),
    getSchedules(id),
    getProjectMeta(id),
  ]);
  if (!myRole || !project) notFound();

  const canEdit   = myRole === "owner" || myRole === "editor";
  const eventDate = project.eventDate;

  // カレンダーのドット用: 各タスクの開始日（タイムラインの section と一致させ、
  // タップ時のスクロール先が必ず存在するようにする）
  const taskDates = Array.from(new Set(list.map((s) => s.startDate)));

  // タイムライン用: 開始日でグループ化（list は startDate 昇順）
  const groups = new Map<string, Schedule[]>();
  for (const s of list) {
    const g = groups.get(s.startDate) ?? [];
    g.push(s);
    groups.set(s.startDate, g);
  }
  // 同じ日付内はステータス順（未着手→進行中→完了）に並べ替える。
  // 同ステータス内は元の id 昇順（list の安定順）を保つ。
  for (const g of groups.values()) {
    g.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  }

  return (
    // 初期表示は常に今月（initialMonth を渡さない）
    <ScheduleMonthProvider>
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-4 flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-zinc-800">スケジュール</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* 今月以外を表示中のときだけ現れる */}
          <TodayButton />
          {canEdit && (
            <ScheduleDialog projectId={id}>
              <Button size="sm" className="bg-amber-700 hover:bg-amber-800 text-white">
                <Plus className="w-4 h-4" /> 追加
              </Button>
            </ScheduleDialog>
          )}
        </div>
      </header>

      <main className="px-4 py-6 flex flex-col gap-6 max-w-lg mx-auto">
        <ScheduleCalendar taskDates={taskDates} eventDate={eventDate} />

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="w-12 h-12 text-zinc-300" />
            <p className="text-zinc-500 text-sm leading-relaxed">
              まだ予定がありません。<br />
              {canEdit
                ? "「追加」ボタンで準備や当日の予定を登録しましょう！"
                : "編集者が予定を登録するとここに表示されます。"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {Array.from(groups.entries()).map(([day, items]) => {
              const isEventDay = eventDate === day;
              return (
                <section key={day} id={`day-${day}`} className="flex flex-col gap-2 scroll-mt-4">
                  <h2 className={`text-sm font-semibold px-1 ${isEventDay ? EVENT_DAY_STYLE.text : "text-zinc-600"}`}>
                    {formatDayHeading(day)}
                    {isEventDay && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <PartyPopper className="w-4 h-4" /> {EVENT_DAY_STYLE.label}
                      </span>
                    )}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {items.map((s) => {
                      // 左端バーは常にステータス色（当日ハイライトは見出し側で表現）
                      const bar = STATUS_STYLE[s.status].bar;
                      // タイトル＋日付の本文（編集トリガーになる部分）
                      const body = (
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-zinc-800 truncate">{s.title}</span>
                          <span className="text-xs text-zinc-400">
                            {formatDateRange(s.startDate, s.endDate)}
                            {s.memo && <> ・ {s.memo}</>}
                          </span>
                        </div>
                      );

                      return (
                        // ステータスバッジを編集トリガーの外に並べ、button入れ子を避ける
                        <li
                          key={s.id}
                          className="bg-white rounded-xl border border-zinc-200 shadow-sm flex overflow-hidden"
                        >
                          <div className={`w-1.5 shrink-0 ${bar}`} />
                          <div className="flex items-center justify-between gap-2 px-3 py-3 flex-1 min-w-0">
                            {canEdit ? (
                              <ScheduleDialog projectId={id} schedule={s}>
                                <button type="button" className="text-left min-w-0 flex-1 active:scale-[0.99] transition-transform">
                                  {body}
                                </button>
                              </ScheduleDialog>
                            ) : (
                              body
                            )}
                            <ScheduleStatusBadge
                              scheduleId={s.id}
                              projectId={id}
                              status={s.status}
                              canEdit={canEdit}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
    </ScheduleMonthProvider>
  );
}
