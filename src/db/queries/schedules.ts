import { db } from "@/db/db";
import { schedules } from "@/db/schema";
import { eq } from "drizzle-orm";

// プロジェクトのスケジュール一覧（開始日昇順、同日は id で安定化）
export async function getSchedules(projectId: string) {
  return db
    .select()
    .from(schedules)
    .where(eq(schedules.projectId, projectId))
    .orderBy(schedules.startDate, schedules.id);
}
