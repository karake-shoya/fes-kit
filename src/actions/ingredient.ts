"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/db";
import { ingredients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";

// 数値文字列を厳密にパースする
// parseFloat は "1,000" → 1 のように途中まで読んで誤った値を通すため、
// カンマ除去後に Number() で全体を検証する（原価計算がズレるのを防ぐ）
function parsePositiveNumber(raw: string | null, label: string): number {
  const cleaned = (raw ?? "").trim().replace(/,/g, "");
  const value   = Number(cleaned);
  if (cleaned === "" || Number.isNaN(value) || value <= 0) {
    throw new Error(`${label}は0より大きい数値で入力してください`);
  }
  return value;
}

// FormDataから材料の入力値をパース・バリデーションする共通処理
function parseIngredientInput(formData: FormData) {
  const name     = (formData.get("name") as string | null)?.trim();
  const unit     = (formData.get("unit") as string | null)?.trim();
  const supplier = (formData.get("supplier") as string | null)?.trim() || null;
  const memo     = (formData.get("memo") as string | null)?.trim() || null;

  if (!name) throw new Error("材料名は必須です");
  if (!unit) throw new Error("単位は必須です");

  const price    = parsePositiveNumber(formData.get("price") as string | null, "単価");
  const quantity = parsePositiveNumber(formData.get("quantity") as string | null, "購入数量");

  return { name, unit, supplier, memo, price, quantity };
}

export async function createIngredient(projectId: string, formData: FormData) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parseIngredientInput(formData);

  await db.insert(ingredients).values({ projectId, ...input });

  revalidatePath(`/projects/${projectId}/ingredients`);
}

export async function updateIngredient(
  ingredientId: string,
  projectId: string,
  formData: FormData
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parseIngredientInput(formData);

  await db
    .update(ingredients)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/ingredients`);
}

export async function deleteIngredient(ingredientId: string, projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  await db
    .delete(ingredients)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/ingredients`);
}
