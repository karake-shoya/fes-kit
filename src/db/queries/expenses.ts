import { db } from "@/db/db";
import { projectExpenses } from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";

// かかるお金（固定費）の一覧。金額の大きい順に並べ、効いている費用を上に出す
export async function getProjectExpenses(projectId: string) {
  return db
    .select()
    .from(projectExpenses)
    .where(eq(projectExpenses.projectId, projectId))
    // 同額のときの並びが揺れないよう id を第2キーに置く
    .orderBy(desc(projectExpenses.amount), projectExpenses.id);
}

// ホームのカード用の軽量集計（件数と合計金額）
export async function getExpenseSummary(
  projectId: string
): Promise<{ count: number; total: number }> {
  const [row] = await db
    .select({
      count: count(),
      total: sql<number>`coalesce(sum(${projectExpenses.amount}), 0)`,
    })
    .from(projectExpenses)
    .where(eq(projectExpenses.projectId, projectId));

  return { count: row?.count ?? 0, total: Number(row?.total ?? 0) };
}
