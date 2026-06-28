"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { projects, projectMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireUser } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";

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
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const name        = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const eventDate   = (formData.get("eventDate") as string | null)?.trim() || null;

  if (!name) throw new Error("プロジェクト名は必須です");

  await db
    .update(projects)
    .set({ name, description, eventDate, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId));

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function deleteProject(projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "owner");

  await db.delete(projects).where(eq(projects.id, projectId));

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
