import { db } from "@/db/db";
import { recipes, recipeIngredients, ingredients } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Recipe } from "@/db/schema";

// 利益率計算に必要な材料行の型
export type RecipeCostRow = {
  ingredientId:    string;
  ingredientName:  string;
  unit:            string;
  pricePerUnit:    number;   // 材料の購入単価
  quantityPerUnit: number;   // 購入数量（この金額で買える量）
  quantityUsed:    number;   // 商品1個あたりの使用量
};

export type RecipeCost = {
  totalCost:  number;   // 1個あたり原価
  profit:     number;   // 1個あたり利益
  profitRate: number;   // 利益率（%）
  lines: (RecipeCostRow & { lineCost: number })[]; // 材料ごとの原価
};

// 原価・利益・利益率を計算する純粋関数（一覧・詳細で共用）
// 計算方針: 使用量・販売価格はいずれも「商品1個分」。servingsは計算に使わない。
export function calcRecipeCost(sellingPrice: number, rows: RecipeCostRow[]): RecipeCost {
  const lines = rows.map((row) => {
    // 1材料あたり原価 = (購入単価 ÷ 購入数量) × 使用量
    // quantityPerUnit が 0 のときはゼロ除算でInfinityになるため原価0として扱う（防御）
    const unitCost = row.quantityPerUnit > 0 ? row.pricePerUnit / row.quantityPerUnit : 0;
    return { ...row, lineCost: unitCost * row.quantityUsed };
  });

  const totalCost  = lines.reduce((sum, l) => sum + l.lineCost, 0);
  const profit     = sellingPrice - totalCost;
  const profitRate = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  return { totalCost, profit, profitRate, lines };
}

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
