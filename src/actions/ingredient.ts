"use server";

import { db } from "@/db/db";
import { ingredients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireProjectRole } from "@/lib/auth";
import { revalidateProject } from "@/lib/revalidate";
import { parsePositiveNumber } from "@/lib/parse";

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
  await requireProjectRole(projectId);

  const input = parseIngredientInput(formData);

  await db.insert(ingredients).values({ projectId, ...input });

  revalidateProject(projectId, "ingredients");
}

export async function updateIngredient(
  ingredientId: string,
  projectId: string,
  formData: FormData
) {
  await requireProjectRole(projectId);

  const input = parseIngredientInput(formData);

  await db
    .update(ingredients)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.projectId, projectId)));

  revalidateProject(projectId, "ingredients");
}

export async function deleteIngredient(ingredientId: string, projectId: string) {
  await requireProjectRole(projectId);

  await db
    .delete(ingredients)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.projectId, projectId)));

  revalidateProject(projectId, "ingredients");
}
