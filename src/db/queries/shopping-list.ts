import { db } from "@/db/db";
import { recipes, recipeIngredients, ingredients } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { calcShoppingList } from "@/lib/shopping-list-calc";

// 積算ロジックと型は src/lib/shopping-list-calc.ts に集約（DB非依存でテストできるようにするため）
export type { ShoppingListItem } from "@/lib/shopping-list-calc";

// プロジェクトホームのバッジ表示用の軽量な件数取得。
// 必要量・費用の計算やソートは行わず、対象材料の件数だけをDB側で数える。
export async function getShoppingListItemCount(projectId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(distinct ${recipeIngredients.ingredientId})` })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .where(eq(recipes.projectId, projectId));

  return Number(row?.value ?? 0);
}

// レシピの「作る予定数」(servings) × 材料の使用量から、材料ごとに
// 買うべきロット数と費用を積算する。計算は calcShoppingList に委譲する。
export async function getShoppingList(projectId: string) {
  const rows = await db
    .select({
      ingredientId:    ingredients.id,
      name:            ingredients.name,
      unit:            ingredients.unit,
      quantityPerUnit: ingredients.quantity,
      pricePerUnit:    ingredients.price,
      quantityUsed:    recipeIngredients.quantityUsed,
      servings:        recipes.servings,
    })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(eq(recipes.projectId, projectId));

  return calcShoppingList(rows);
}
