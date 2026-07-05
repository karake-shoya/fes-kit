import { db } from "@/db/db";
import { checklistItems } from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";

// プロジェクトの持ち物・準備チェックリスト一覧（作成順。カテゴリ別の並び替えはlib側で行う）
export async function getChecklistItems(projectId: string) {
  return db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.projectId, projectId))
    .orderBy(checklistItems.createdAt, checklistItems.id);
}

// ホームのカードバッジ・進捗バー用の件数集計
export async function getChecklistStats(projectId: string): Promise<{ total: number; checked: number }> {
  const [row] = await db
    .select({
      total:   count(),
      checked: sql<number>`coalesce(sum(case when ${checklistItems.checked} then 1 else 0 end), 0)`,
    })
    .from(checklistItems)
    .where(eq(checklistItems.projectId, projectId));

  return {
    total:   row?.total ?? 0,
    checked: Number(row?.checked ?? 0),
  };
}
