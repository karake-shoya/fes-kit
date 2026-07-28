import { getRecipes } from "@/db/queries/recipes";
import { getProjectExpenses } from "@/db/queries/expenses";
import { getExpectedVisitors } from "@/db/queries/projects";
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

// 採算シミュレーション画面が必要とする一式（商品・かかるお金・想定来場者数）
export async function getSimulationInput(projectId: string) {
  const [recipeList, expenses, expectedVisitors] = await Promise.all([
    getRecipes(projectId),
    getProjectExpenses(projectId),
    getExpectedVisitors(projectId),
  ]);

  return {
    recipes:   toBreakevenRecipes(recipeList),
    expenses,
    fixedCost: sumExpenses(expenses),
    expectedVisitors,
  };
}
