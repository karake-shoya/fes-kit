"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/db";
import { schedules } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";
import { isValidYmd, nextStatus, STATUS_ORDER, type ScheduleStatus } from "@/lib/schedule";

// FormDataからスケジュールの入力値をパース・バリデーションする
function parseScheduleInput(formData: FormData) {
  const title     = (formData.get("title") as string | null)?.trim();
  const memo      = (formData.get("memo") as string | null)?.trim() || null;
  const startDate = (formData.get("startDate") as string | null)?.trim() ?? "";
  // 終了日は未入力なら開始日と同値（1日タスク）
  const endRaw    = (formData.get("endDate") as string | null)?.trim();
  const statusRaw = (formData.get("status") as string | null)?.trim() ?? "todo";

  if (!title) throw new Error("タイトルは必須です");
  if (!isValidYmd(startDate)) throw new Error("開始日を正しく入力してください");

  const endDate = endRaw && endRaw !== "" ? endRaw : startDate;
  if (!isValidYmd(endDate)) throw new Error("終了日を正しく入力してください");
  if (endDate < startDate) throw new Error("終了日は開始日以降にしてください");

  const status = STATUS_ORDER.includes(statusRaw as ScheduleStatus)
    ? (statusRaw as ScheduleStatus)
    : "todo";

  return { title, memo, startDate, endDate, status };
}

export async function createSchedule(projectId: string, formData: FormData) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parseScheduleInput(formData);

  await db.insert(schedules).values({ projectId, ...input });

  revalidatePath(`/projects/${projectId}/schedule`);
}

export async function updateSchedule(
  scheduleId: string,
  projectId: string,
  formData: FormData
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parseScheduleInput(formData);

  await db
    .update(schedules)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(schedules.id, scheduleId), eq(schedules.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/schedule`);
}

export async function deleteSchedule(scheduleId: string, projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  await db
    .delete(schedules)
    .where(and(eq(schedules.id, scheduleId), eq(schedules.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/schedule`);
}

// ステータスをワンタップで次へ進める（未着手→進行中→完了→未着手）
export async function cycleScheduleStatus(scheduleId: string, projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  // 現在のステータスを取得（プロジェクト越境防止のため projectId も照合）
  const [current] = await db
    .select({ status: schedules.status })
    .from(schedules)
    .where(and(eq(schedules.id, scheduleId), eq(schedules.projectId, projectId)))
    .limit(1);
  if (!current) throw new Error("スケジュールが見つかりません");

  await db
    .update(schedules)
    .set({ status: nextStatus(current.status), updatedAt: new Date().toISOString() })
    .where(and(eq(schedules.id, scheduleId), eq(schedules.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/schedule`);
}
