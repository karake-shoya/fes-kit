"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/db";
import { salesRecords } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";
import { assertRecipeInProject } from "@/db/queries/recipes";
import { parseNonNegativeInt } from "@/lib/parse";

// 当日の実績（作った数・売れた数）をレシピ単位でupsertする。
// 1レシピ1レコードの都度上書き方式（時間帯別の複数記録はしない）。
export async function setSalesRecord(
  recipeId: string,
  projectId: string,
  input: { madeCount: string | number; soldCount: string | number }
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");
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

  // 実績ページ自身は revalidate しない。呼び出し元カードがローカルstateで
  // 最新値を表示しており、保存のたびに再レンダーが返ると連打編集中の値が
  // 古いサーバー値に巻き戻される競合の原因になるため（再訪時は動的レンダーで整合）。
  revalidatePath(`/projects/${projectId}`); // ホームのバッジ（記録済み件数）
}
