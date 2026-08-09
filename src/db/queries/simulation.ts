import { getRecipes } from "@/db/queries/recipes";
import { getProjectExpenses } from "@/db/queries/expenses";
import { getSimulationSettings } from "@/db/queries/projects";
import { getScenarios } from "@/db/queries/scenarios";
import { sumExpenses, type BreakevenRecipe } from "@/lib/breakeven";

// レシピ一覧（原価計算済み）を損益分岐点の入力に変換する。
// ホームのカードは getRecipes を既に走らせているため、同じ問い合わせを
// 二度投げずに済むよう変換だけを切り出している
export function toBreakevenRecipes(
  list: Awaited<ReturnType<typeof getRecipes>>
): BreakevenRecipe[] {
  return list.map(({ recipe, cost, ingredientCount }) => ({
    recipeId:     recipe.id,
    name:         recipe.name,
    sellingPrice: recipe.sellingPrice,
    unitCost:     cost.totalCost,
    servings:     recipe.servings,
    // 材料未登録は原価0＝利益を過大評価するため、計算から外す目印にする
    hasCost:      ingredientCount > 0,
  }));
}

// 採算の計算そのものに要る一式（商品・かかるお金・想定来場者数・目標利益）。
// AI診断のように保存済みパターンを見ない用途はこちらを使う
export async function getBreakevenInput(projectId: string) {
  const [recipeList, expenses, settings] = await Promise.all([
    getRecipes(projectId),
    getProjectExpenses(projectId),
    getSimulationSettings(projectId),
  ]);

  return {
    recipes:   toBreakevenRecipes(recipeList),
    expenses,
    fixedCost: sumExpenses(expenses),
    ...settings,
  };
}

// 採算シミュレーション画面が必要とする一式
// （上記 ＋ 保存済みのパターン ＋ 「これにする」直前の自動控え）
export async function getSimulationInput(projectId: string) {
  const [base, { patterns, backup }] = await Promise.all([
    getBreakevenInput(projectId),
    getScenarios(projectId),
  ]);

  return { ...base, scenarios: patterns, backup };
}
