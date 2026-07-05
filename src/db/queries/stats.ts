import { db } from "@/db/db";
import { schedules } from "@/db/schema";
import { and, count, eq, gte, ne, sql } from "drizzle-orm";

// プロジェクトホームのサマリー用の集計。
// 各画面への主導線をタブバーに集約したため、ホームで使うのは
// タスクの完了数／総数（進捗バー用）のみ。
export async function getProjectStats(projectId: string) {
  // タスクの総数と完了数は同じ行への集計なので1クエリにまとめる
  const [tasks] = await db
    .select({
      total: count(),
      done: sql<number>`coalesce(sum(case when ${schedules.status} = 'done' then 1 else 0 end), 0)`,
    })
    .from(schedules)
    .where(eq(schedules.projectId, projectId));

  return {
    tasksTotal: tasks.total,
    tasksDone:  Number(tasks.done),
  };
}

// 今日以降にかかっている未完了タスクを直近順に取得（「次にやること」表示用）
export async function getUpcomingSchedules(
  projectId: string,
  today: string,
  limit = 3
) {
  return db
    .select({
      id:        schedules.id,
      title:     schedules.title,
      startDate: schedules.startDate,
      endDate:   schedules.endDate,
      status:    schedules.status,
    })
    .from(schedules)
    .where(
      and(
        eq(schedules.projectId, projectId),
        ne(schedules.status, "done"),
        gte(schedules.endDate, today)
      )
    )
    .orderBy(schedules.startDate, schedules.id)
    .limit(limit);
}
