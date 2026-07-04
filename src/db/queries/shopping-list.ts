import { db } from "@/db/db";
import { recipes, recipeIngredients, ingredients } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

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

// 買い出しリストの1材料分
export type ShoppingListItem = {
  ingredientId:    string;
  name:            string;
  unit:            string;
  neededQuantity:  number; // 全レシピ分の必要合計使用量
  quantityPerUnit: number; // 1ロットの内容量
  pricePerUnit:    number; // 1ロットの価格
  lotsNeeded:      number; // 買うべきロット数
  cost:            number; // lotsNeeded × pricePerUnit
};

// レシピの「作る予定数」(servings) × 材料の使用量から、材料ごとに
// 買うべきロット数と費用を積算する。在庫管理はしないため、必要量は常に
// ゼロからの購入量として計算する（新規イベントの買い出し計画という前提）。
export async function getShoppingList(
  projectId: string
): Promise<{ items: ShoppingListItem[]; totalCost: number }> {
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

  // ingredientId ごとに必要量を積算する
  const byIngredient = new Map<
    string,
    { name: string; unit: string; quantityPerUnit: number; pricePerUnit: number; neededQuantity: number }
  >();

  for (const row of rows) {
    const acc = byIngredient.get(row.ingredientId) ?? {
      name:            row.name,
      unit:            row.unit,
      quantityPerUnit: row.quantityPerUnit,
      pricePerUnit:    row.pricePerUnit,
      neededQuantity:  0,
    };
    acc.neededQuantity += row.quantityUsed * row.servings;
    byIngredient.set(row.ingredientId, acc);
  }

  const items: ShoppingListItem[] = Array.from(byIngredient.entries())
    .map(([ingredientId, acc]) => {
      // quantityPerUnit が0以下の材料は購入ロットを計算できないため0扱いにする（ゼロ除算防止）。
      // 除算前に微小なイプシロンを引き、浮動小数点の丸め誤差（例: 6.300000000000001）で
      // ちょうど整数倍のはずの値が繰り上がってロット数を1つ多く見積もるのを防ぐ。
      const lotsNeeded = acc.quantityPerUnit > 0
        ? Math.ceil(acc.neededQuantity / acc.quantityPerUnit - 1e-9)
        : 0;
      const cost = lotsNeeded * acc.pricePerUnit;

      return {
        ingredientId,
        name:            acc.name,
        unit:            acc.unit,
        neededQuantity:  acc.neededQuantity,
        quantityPerUnit: acc.quantityPerUnit,
        pricePerUnit:    acc.pricePerUnit,
        lotsNeeded,
        cost,
      };
    })
    .sort((a, b) => b.cost - a.cost);

  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

  return { items, totalCost };
}
