"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { projects, projectMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireProjectRole, requireUser } from "@/lib/auth";
import { revalidateProject } from "@/lib/revalidate";
import { parseNonNegativeInt } from "@/lib/parse";

export async function createProject(formData: FormData) {
  // requireUser() でWebhook未着時もDBにユーザーをUPSERTしてからFK制約を通す
  const user = await requireUser();
  const userId = user.id;

  const name        = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const eventDate   = (formData.get("eventDate") as string | null)?.trim() || null;

  if (!name) throw new Error("プロジェクト名は必須です");

  const [project] = await db
    .insert(projects)
    .values({ name, description, eventDate, ownerId: userId })
    .returning();

  // 作成者を owner として登録
  await db.insert(projectMembers).values({
    projectId: project.id,
    userId,
    role: "owner",
  });

  revalidatePath("/dashboard");
  return { projectId: project.id };
}

export async function updateProject(projectId: string, formData: FormData) {
  await requireProjectRole(projectId);

  const name        = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const eventDate   = (formData.get("eventDate") as string | null)?.trim() || null;
  const visitorsRaw = (formData.get("expectedVisitors") as string | null)?.trim() ?? "";

  if (!name) throw new Error("プロジェクト名は必須です");

  // 想定来場者数は任意。未入力なら null に戻し、購入率の判定を行わない
  const expectedVisitors = visitorsRaw === ""
    ? null
    : parseNonNegativeInt(visitorsRaw, "想定来場者数");

  await db
    .update(projects)
    .set({ name, description, eventDate, expectedVisitors, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId));

  revalidateProject(projectId, "project");
}

export async function deleteProject(projectId: string) {
  await requireProjectRole(projectId, "owner");

  await db.delete(projects).where(eq(projects.id, projectId));

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
