"use server";

import { db } from "@/db/db";
import { salesRecords } from "@/db/schema";
import { requireProjectRole } from "@/lib/auth";
import { revalidateProject } from "@/lib/revalidate";
import { assertRecipeInProject } from "@/db/queries/recipes";
import { parseNonNegativeInt } from "@/lib/parse";

// 当日の実績（作った数・売れた数）をレシピ単位でupsertする。
// 1レシピ1レコードの都度上書き方式（時間帯別の複数記録はしない）。
export async function setSalesRecord(
  recipeId: string,
  projectId: string,
  input: { madeCount: string | number; soldCount: string | number }
) {
  await requireProjectRole(projectId);
  await assertRecipeInProject(recipeId, projectId);

  const madeCount = parseNonNegativeInt(input.madeCount, "作った数");
  const soldCount = parseNonNegativeInt(input.soldCount, "売れた数");

  await db
    .insert(salesRecords)
    .values({ recipeId, madeCount, soldCount })
    .onConflictDoUpdate({
      target: salesRecords.recipeId,
      set: { madeCount, soldCount, updatedAt: new Date().toISOString() },
    });

  // 実績ページ自身を再検証しない理由は revalidate.ts の対応表に書いてある
  // （連打編集中の値がサーバー値に巻き戻るのを避けるため、ホームのバッジだけ更新する）
  revalidateProject(projectId, "salesRecords");
}
