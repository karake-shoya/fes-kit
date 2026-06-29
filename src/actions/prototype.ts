"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/db";
import { prototypeLogs, recipes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";
import { assertRecipeInProject } from "@/db/queries/recipes";
import { deletePrototypeImage } from "@/lib/r2";

const VALID_RESULTS = ["good", "needs_improvement", "failed"] as const;
type PrototypeResult = (typeof VALID_RESULTS)[number];

function parsePrototypeInput(formData: FormData) {
  const recipeId  = (formData.get("recipeId")  as string | null)?.trim();
  const triedAt   = (formData.get("triedAt")   as string | null)?.trim();
  const resultRaw = (formData.get("result")    as string | null)?.trim() ?? "needs_improvement";
  const memo      = (formData.get("memo")      as string | null)?.trim() || null;
  const imageUrl  = (formData.get("imageUrl")  as string | null)?.trim() || null;

  if (!recipeId) throw new Error("レシピは必須です");
  if (!triedAt || !/^\d{4}-\d{2}-\d{2}$/.test(triedAt)) throw new Error("試作日を正しく入力してください");

  const result: PrototypeResult = (VALID_RESULTS as readonly string[]).includes(resultRaw)
    ? (resultRaw as PrototypeResult)
    : "needs_improvement";

  return { recipeId, triedAt, result, memo, imageUrl };
}

// prototype_logs が当該プロジェクトに属するか確認する（越境防止）。
// 既存の写真URLも返す（差し替え・削除時のR2クリーンアップに使用）。
async function assertPrototypeInProject(prototypeId: string, projectId: string) {
  const [row] = await db
    .select({ id: prototypeLogs.id, imageUrl: prototypeLogs.imageUrl })
    .from(prototypeLogs)
    .innerJoin(recipes, and(
      eq(recipes.id, prototypeLogs.recipeId),
      eq(recipes.projectId, projectId),
    ))
    .where(eq(prototypeLogs.id, prototypeId))
    .limit(1);
  if (!row) throw new Error("試作記録が見つかりません");
  return row;
}

export async function createPrototype(projectId: string, formData: FormData) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parsePrototypeInput(formData);
  await assertRecipeInProject(input.recipeId, projectId);

  const [log] = await db
    .insert(prototypeLogs)
    .values(input)
    .returning({ id: prototypeLogs.id });

  revalidatePath(`/projects/${projectId}/prototypes`);
  return { prototypeId: log.id };
}

export async function updatePrototype(
  prototypeId: string,
  projectId: string,
  formData: FormData
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");
  const existing = await assertPrototypeInProject(prototypeId, projectId);

  const input = parsePrototypeInput(formData);
  await assertRecipeInProject(input.recipeId, projectId);

  await db
    .update(prototypeLogs)
    .set(input)
    .where(eq(prototypeLogs.id, prototypeId));

  // 写真が差し替え・削除された場合は古いオブジェクトを掃除する
  if (existing.imageUrl && existing.imageUrl !== input.imageUrl) {
    await deletePrototypeImage(existing.imageUrl);
  }

  revalidatePath(`/projects/${projectId}/prototypes`);
}

export async function deletePrototype(prototypeId: string, projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");
  const existing = await assertPrototypeInProject(prototypeId, projectId);

  await db
    .delete(prototypeLogs)
    .where(eq(prototypeLogs.id, prototypeId));

  // 紐づく写真もR2から掃除する
  await deletePrototypeImage(existing.imageUrl);

  revalidatePath(`/projects/${projectId}/prototypes`);
}
