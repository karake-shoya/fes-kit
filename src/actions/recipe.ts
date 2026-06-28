"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/db";
import { recipes, recipeIngredients, ingredients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";
import { assertRecipeInProject } from "@/db/queries/recipes";
import { parsePositiveNumber, parsePositiveInt } from "@/lib/parse";

// FormDataからレシピ本体の入力値をパース・バリデーションする
function parseRecipeInput(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim();
  const memo = (formData.get("memo") as string | null)?.trim() || null;

  if (!name) throw new Error("商品名は必須です");

  const sellingPrice = parsePositiveNumber(formData.get("sellingPrice") as string | null, "販売価格");
  // servings（予定数）は任意・既定1の整数
  const servings = parsePositiveInt(formData.get("servings") as string | null, "作る予定数", 1);

  return { name, memo, sellingPrice, servings };
}

// ingredientId が当該プロジェクトの材料か照合する（越境防止）
async function assertIngredientInProject(ingredientId: string, projectId: string) {
  const [ingredient] = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.projectId, projectId)))
    .limit(1);
  if (!ingredient) throw new Error("材料が見つかりません");
}

export async function createRecipe(projectId: string, formData: FormData) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parseRecipeInput(formData);

  const [recipe] = await db
    .insert(recipes)
    .values({ projectId, ...input })
    .returning();

  revalidatePath(`/projects/${projectId}/recipes`);
  return { recipeId: recipe.id };
}

export async function updateRecipe(
  recipeId: string,
  projectId: string,
  formData: FormData
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parseRecipeInput(formData);

  await db
    .update(recipes)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(recipes.id, recipeId), eq(recipes.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/recipes`);
  revalidatePath(`/projects/${projectId}/recipes/${recipeId}`);
}

export async function deleteRecipe(recipeId: string, projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  await db
    .delete(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/recipes`);
}

// レシピに材料を追加、または使用量を更新する（upsert）
export async function setRecipeIngredient(
  recipeId: string,
  projectId: string,
  ingredientId: string,
  quantityUsedRaw: string
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  // recipe / ingredient がともにこのプロジェクトのものか照合（越境防止）
  await assertRecipeInProject(recipeId, projectId);
  await assertIngredientInProject(ingredientId, projectId);

  const quantityUsed = parsePositiveNumber(quantityUsedRaw, "使用量");

  await db
    .insert(recipeIngredients)
    .values({ recipeId, ingredientId, quantityUsed })
    .onConflictDoUpdate({
      target: [recipeIngredients.recipeId, recipeIngredients.ingredientId],
      set: { quantityUsed },
    });

  revalidatePath(`/projects/${projectId}/recipes`);
  revalidatePath(`/projects/${projectId}/recipes/${recipeId}`);
}

// レシピから材料を外す
export async function removeRecipeIngredient(
  recipeId: string,
  projectId: string,
  ingredientId: string
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  // recipe がこのプロジェクトのものか照合（越境防止）
  await assertRecipeInProject(recipeId, projectId);

  await db
    .delete(recipeIngredients)
    .where(
      and(
        eq(recipeIngredients.recipeId, recipeId),
        eq(recipeIngredients.ingredientId, ingredientId)
      )
    );

  revalidatePath(`/projects/${projectId}/recipes`);
  revalidatePath(`/projects/${projectId}/recipes/${recipeId}`);
}
