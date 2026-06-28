import { db } from "@/db/db";
import { prototypeLogs, recipes } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { PrototypeLog } from "@/db/schema";

export type PrototypeWithRecipe = PrototypeLog & { recipeName: string };

const PROTOTYPE_COLS = {
  id:         prototypeLogs.id,
  recipeId:   prototypeLogs.recipeId,
  triedAt:    prototypeLogs.triedAt,
  result:     prototypeLogs.result,
  memo:       prototypeLogs.memo,
  imageUrl:   prototypeLogs.imageUrl,
  createdAt:  prototypeLogs.createdAt,
  recipeName: recipes.name,
};

// プロジェクトの試作記録一覧（試作日降順、同日は id で安定化）
export async function getPrototypes(projectId: string): Promise<PrototypeWithRecipe[]> {
  return db
    .select(PROTOTYPE_COLS)
    .from(prototypeLogs)
    .innerJoin(recipes, eq(recipes.id, prototypeLogs.recipeId))
    .where(eq(recipes.projectId, projectId))
    .orderBy(desc(prototypeLogs.triedAt), prototypeLogs.id);
}

// 試作記録詳細（projectId照合でプロジェクト越境防止）
export async function getPrototype(
  prototypeId: string,
  projectId: string
): Promise<PrototypeWithRecipe | null> {
  const [row] = await db
    .select(PROTOTYPE_COLS)
    .from(prototypeLogs)
    .innerJoin(recipes, eq(recipes.id, prototypeLogs.recipeId))
    .where(and(eq(prototypeLogs.id, prototypeId), eq(recipes.projectId, projectId)))
    .limit(1);

  return row ?? null;
}
