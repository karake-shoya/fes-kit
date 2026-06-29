import { db } from "@/db/db";
import { recipes, recipeIngredients, ingredients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { Recipe } from "@/db/schema";
import { calcRecipeCost, type RecipeCostRow, type RecipeCost } from "@/lib/recipe-cost";

// 原価計算の型・純粋関数は src/lib/recipe-cost.ts に集約（クライアントと共用）
export { calcRecipeCost } from "@/lib/recipe-cost";
export type { RecipeCostRow, RecipeCost } from "@/lib/recipe-cost";

// レシピ一覧（各レシピの原価・利益率付き）
// recipes と材料行を一括取得し、JSでレシピ単位に集約してN+1を回避する
export async function getRecipes(projectId: string) {
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.projectId, projectId))
    // createdAt は秒精度のため同秒作成の順序が揺れる。id を第2キーに安定化する
    .orderBy(recipes.createdAt, recipes.id);

  if (recipeRows.length === 0) return [];

  // このプロジェクトの全レシピ材料行をまとめて取得
  const ingredientRows = await db
    .select({
      recipeId:        recipeIngredients.recipeId,
      ingredientId:    ingredients.id,
      ingredientName:  ingredients.name,
      unit:            ingredients.unit,
      pricePerUnit:    ingredients.price,
      quantityPerUnit: ingredients.quantity,
      quantityUsed:    recipeIngredients.quantityUsed,
    })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(eq(recipes.projectId, projectId));

  // recipeId ごとに材料行を束ねる
  const byRecipe = new Map<string, RecipeCostRow[]>();
  for (const row of ingredientRows) {
    const { recipeId, ...rest } = row;
    const list = byRecipe.get(recipeId) ?? [];
    list.push(rest);
    byRecipe.set(recipeId, list);
  }

  return recipeRows.map((recipe) => {
    const rows = byRecipe.get(recipe.id) ?? [];
    return {
      recipe,
      cost: calcRecipeCost(recipe.sellingPrice, rows),
      ingredientCount: rows.length,
    };
  });
}

// レシピ詳細（本体 + 材料行 + 原価計算）
// 材料未登録でも recipe 本体を返せるよう、本体と材料を別取得する
export async function getRecipeWithCost(
  recipeId: string,
  projectId: string
): Promise<{ recipe: Recipe; cost: RecipeCost } | null> {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  // 他プロジェクトのレシピを誤って開かないよう projectId も照合
  if (!recipe || recipe.projectId !== projectId) return null;

  const rows = await db
    .select({
      ingredientId:    ingredients.id,
      ingredientName:  ingredients.name,
      unit:            ingredients.unit,
      pricePerUnit:    ingredients.price,
      quantityPerUnit: ingredients.quantity,
      quantityUsed:    recipeIngredients.quantityUsed,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(eq(recipeIngredients.recipeId, recipeId));

  return { recipe, cost: calcRecipeCost(recipe.sellingPrice, rows) };
}

// レシピのid・nameのみ取得（ドロップダウン用軽量クエリ）
export async function getRecipeNames(projectId: string) {
  return db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(eq(recipes.projectId, projectId))
    .orderBy(recipes.name, recipes.id);
}

// recipeId が当該プロジェクトのレシピか照合する（越境防止）
// actions/recipe.ts・actions/prototype.ts で共用
export async function assertRecipeInProject(recipeId: string, projectId: string) {
  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.projectId, projectId)))
    .limit(1);
  if (!recipe) throw new Error("レシピが見つかりません");
}
