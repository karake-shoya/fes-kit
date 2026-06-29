import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getSchedules } from "@/db/queries/schedules";
import { getProjectMeta, getMyRole } from "@/db/queries/projects";
import { ScheduleDialog } from "@/components/app/schedule-dialog";
import { ScheduleBoard } from "@/components/app/schedule-board";
import { ScheduleMonthProvider, TodayButton } from "@/components/app/schedule-month";
import { AppHeader } from "@/components/app/app-header";
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
      <div className="min-h-screen bg-background">
        <AppHeader
          title="スケジュール"
          backHref={`/projects/${id}`}
          action={
            <>
              {/* 今月以外を表示中のときだけ現れる */}
              <TodayButton />
              {canEdit && (
                <ScheduleDialog projectId={id}>
                  <Button size="sm">
                    <Plus className="w-4 h-4" /> 追加
                  </Button>
                </ScheduleDialog>
              )}
            </>
          }
        />

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
