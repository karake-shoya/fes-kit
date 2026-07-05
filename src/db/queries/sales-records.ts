import { db } from "@/db/db";
import { recipes, salesRecords } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getRecipeCostRowsByRecipe } from "@/db/queries/recipes";
import { calcRecipeCost, type RecipeCost } from "@/lib/recipe-cost";

// 実績記録ページの1レシピ分
// 見込み利益・実績利益・廃棄数はカード側（sales-record-card.tsx）が
// ローカル編集値から即時再計算するため、ここでは素材（cost・実績数）だけを返す
export type SalesResultItem = {
  recipe: {
    id:           string;
    name:         string;
    sellingPrice: number;
    servings:     number;   // 作る予定数（見込みの基準）
  };
  cost:      RecipeCost;
  madeCount: number;        // 作った数（未記録は0）
  soldCount: number;        // 売れた数（未記録は0）
  recorded:  boolean;       // 実績レコードの有無
};

// 全レシピの見込み利益と実績利益を集計して返す。
// 材料行の取得・集約は getRecipeCostRowsByRecipe（recipes.tsと共用）に集約する。
export async function getSalesResults(projectId: string): Promise<{
  items: SalesResultItem[];
  totalExpected: number;
  totalActual: number;
}> {
  const recipeRows = await db
    .select({
      id:           recipes.id,
      name:         recipes.name,
      sellingPrice: recipes.sellingPrice,
      servings:     recipes.servings,
      madeCount:    salesRecords.madeCount,
      soldCount:    salesRecords.soldCount,
    })
    .from(recipes)
    .leftJoin(salesRecords, eq(salesRecords.recipeId, recipes.id))
    .where(eq(recipes.projectId, projectId))
    // createdAt は秒精度のため同秒作成の順序が揺れる。id を第2キーに安定化する
    .orderBy(recipes.createdAt, recipes.id);

  if (recipeRows.length === 0) {
    return { items: [], totalExpected: 0, totalActual: 0 };
  }

  const byRecipe = await getRecipeCostRowsByRecipe(projectId);

  const items: SalesResultItem[] = recipeRows.map((row) => ({
    recipe: {
      id:           row.id,
      name:         row.name,
      sellingPrice: row.sellingPrice,
      servings:     row.servings,
    },
    cost:      calcRecipeCost(row.sellingPrice, byRecipe.get(row.id) ?? []),
    madeCount: row.madeCount ?? 0,
    soldCount: row.soldCount ?? 0,
    recorded:  row.madeCount !== null,
  }));

  // 材料未登録（原価0）のレシピは profit が販売価格まるごとになり
  // 架空の利益が合計に混入するため、原価が確定しているレシピだけを合算する
  const costed        = items.filter((it) => it.cost.totalCost > 0);
  const totalExpected = costed.reduce((sum, it) => sum + it.cost.profit * it.recipe.servings, 0);
  const totalActual   = costed.reduce((sum, it) => sum + it.cost.profit * it.soldCount, 0);

  return { items, totalExpected, totalActual };
}

// プロジェクトホームのバッジ表示用の軽量な件数取得。
// 実績記録済みのレシピ数だけをDB側で数える。
export async function getSalesRecordCount(projectId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(salesRecords)
    .innerJoin(recipes, eq(recipes.id, salesRecords.recipeId))
    .where(eq(recipes.projectId, projectId));

  return Number(row?.value ?? 0);
}
