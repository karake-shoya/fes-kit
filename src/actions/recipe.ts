"use server";

import { db } from "@/db/db";
import { recipes, recipeIngredients, ingredients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireProjectRole } from "@/lib/auth";
import { revalidateProject } from "@/lib/revalidate";
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
  await requireProjectRole(projectId);

  const input = parseRecipeInput(formData);

  const [recipe] = await db
    .insert(recipes)
    .values({ projectId, ...input })
    .returning();

  revalidateProject(projectId, "recipes", { recipeId: recipe.id });
  return { recipeId: recipe.id };
}

export async function updateRecipe(
  recipeId: string,
  projectId: string,
  formData: FormData
) {
  await requireProjectRole(projectId);

  const input = parseRecipeInput(formData);

  await db
    .update(recipes)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(recipes.id, recipeId), eq(recipes.projectId, projectId)));

  revalidateProject(projectId, "recipes", { recipeId });
}

export async function deleteRecipe(recipeId: string, projectId: string) {
  await requireProjectRole(projectId);

  await db
    .delete(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.projectId, projectId)));

  revalidateProject(projectId, "recipes", { recipeId });
}

// 販売価格のみを更新する軽量アクション（スライダーのドラッグ確定時に呼ぶ）
// 本体編集ダイアログを開かずに価格を直接調整できるようにする
export async function setRecipeSellingPrice(
  recipeId: string,
  projectId: string,
  sellingPriceRaw: string | number
) {
  await requireProjectRole(projectId);
  await assertRecipeInProject(recipeId, projectId);

  const sellingPrice = parsePositiveNumber(String(sellingPriceRaw), "販売価格");

  await db
    .update(recipes)
    .set({ sellingPrice, updatedAt: new Date().toISOString() })
    .where(and(eq(recipes.id, recipeId), eq(recipes.projectId, projectId)));

  revalidateProject(projectId, "recipes", { recipeId });
}

// 作る予定数のみを更新する軽量アクション（詳細ページのインライン編集用）
// 買い出しリストの必要量計算に使うため、設定ダイアログを開かなくても直接調整できるようにする
export async function setRecipeServings(
  recipeId: string,
  projectId: string,
  servingsRaw: string | number
) {
  await requireProjectRole(projectId);
  await assertRecipeInProject(recipeId, projectId);

  const servings = parsePositiveInt(String(servingsRaw), "作る予定数", 1);

  await db
    .update(recipes)
    .set({ servings, updatedAt: new Date().toISOString() })
    .where(and(eq(recipes.id, recipeId), eq(recipes.projectId, projectId)));

  revalidateProject(projectId, "recipes", { recipeId });
}

// レシピに材料を追加、または使用量を更新する（upsert）
export async function setRecipeIngredient(
  recipeId: string,
  projectId: string,
  ingredientId: string,
  quantityUsedRaw: string
) {
  await requireProjectRole(projectId);

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

  revalidateProject(projectId, "recipes", { recipeId });
}

// レシピから材料を外す
export async function removeRecipeIngredient(
  recipeId: string,
  projectId: string,
  ingredientId: string
) {
  await requireProjectRole(projectId);

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

  revalidateProject(projectId, "recipes", { recipeId });
}
