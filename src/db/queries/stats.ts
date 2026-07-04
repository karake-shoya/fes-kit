import { db } from "@/db/db";
import { ingredients, recipes, prototypeLogs, schedules } from "@/db/schema";
import { and, count, eq, gte, ne, sql } from "drizzle-orm";

// プロジェクトホームのサマリー用件数。
// 材料・試作の件数と、タスクの完了数／総数をまとめて返す。
// レシピ件数はホーム側で別途取得する一覧（recipeList.length）から求めるため、
// ここでは重複カウントしない。
export async function getProjectStats(projectId: string) {
  const [[ing], [proto], [tasks]] = await Promise.all([
    db
      .select({ value: count() })
      .from(ingredients)
      .where(eq(ingredients.projectId, projectId)),
    db
      .select({ value: count() })
      .from(prototypeLogs)
      .innerJoin(recipes, eq(recipes.id, prototypeLogs.recipeId))
      .where(eq(recipes.projectId, projectId)),
    // タスクの総数と完了数は同じ行への集計なので1クエリにまとめる
    db
      .select({
        total: count(),
        done: sql<number>`coalesce(sum(case when ${schedules.status} = 'done' then 1 else 0 end), 0)`,
      })
      .from(schedules)
      .where(eq(schedules.projectId, projectId)),
  ]);

  return {
    ingredients: ing.value,
    prototypes:  proto.value,
    tasksTotal:  tasks.total,
    tasksDone:   Number(tasks.done),
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
