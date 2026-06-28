import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getSchedules } from "@/db/queries/schedules";
import { getProjectMeta, getMyRole } from "@/db/queries/projects";
import { ScheduleDialog } from "@/components/app/schedule-dialog";
import { ScheduleBoard } from "@/components/app/schedule-board";
import { ScheduleMonthProvider, TodayButton } from "@/components/app/schedule-month";
import { Button } from "@/components/ui/button";

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

        <main className="px-4 py-6 max-w-lg mx-auto">
          <ScheduleBoard
            projectId={id}
            eventDate={eventDate}
            canEdit={canEdit}
            schedules={list}
          />
        </main>
      </div>
    </ScheduleMonthProvider>
  );
}
