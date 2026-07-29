"use server";

import { db } from "@/db/db";
import { projectExpenses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireProjectRole } from "@/lib/auth";
import { revalidateProject } from "@/lib/revalidate";
import { parsePositiveNumber } from "@/lib/parse";

// FormDataからかかるお金の入力値をパース・バリデーションする
function parseExpenseInput(formData: FormData) {
  const label = (formData.get("label") as string | null)?.trim();
  const memo  = (formData.get("memo") as string | null)?.trim() || null;

  if (!label) throw new Error("費目は必須です");

  const amount = parsePositiveNumber(formData.get("amount") as string | null, "金額");

  return { label, amount, memo };
}

export async function createExpense(projectId: string, formData: FormData) {
  await requireProjectRole(projectId);

  const input = parseExpenseInput(formData);

  await db.insert(projectExpenses).values({ projectId, ...input });

  revalidateProject(projectId, "expenses");
}

export async function updateExpense(
  expenseId: string,
  projectId: string,
  formData: FormData
) {
  await requireProjectRole(projectId);

  const input = parseExpenseInput(formData);

  await db
    .update(projectExpenses)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(projectExpenses.id, expenseId), eq(projectExpenses.projectId, projectId)));

  revalidateProject(projectId, "expenses");
}

export async function deleteExpense(expenseId: string, projectId: string) {
  await requireProjectRole(projectId);

  await db
    .delete(projectExpenses)
    .where(and(eq(projectExpenses.id, expenseId), eq(projectExpenses.projectId, projectId)));

  revalidateProject(projectId, "expenses");
}
