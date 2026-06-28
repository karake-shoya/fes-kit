import { db } from "@/db/db";
import { ingredients } from "@/db/schema";
import { eq } from "drizzle-orm";

// プロジェクトの材料一覧（作成順）
export async function getIngredients(projectId: string) {
  return db
    .select()
    .from(ingredients)
    .where(eq(ingredients.projectId, projectId))
    .orderBy(ingredients.createdAt);
}
