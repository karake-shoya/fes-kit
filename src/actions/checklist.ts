"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/db";
import { checklistItems } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";
import { getShoppingList } from "@/db/queries/shopping-list";
import { CATEGORY_ORDER, type ChecklistCategory } from "@/lib/checklist";
import { round1 } from "@/lib/recipe-cost";
import { formatYen } from "@/lib/format";

// FormDataから持ち物の入力値をパース・バリデーションする
function parseChecklistInput(formData: FormData) {
  const label       = (formData.get("label") as string | null)?.trim();
  const categoryRaw = (formData.get("category") as string | null)?.trim() ?? "tool";

  if (!label) throw new Error("名前は必須です");

  const category = CATEGORY_ORDER.includes(categoryRaw as ChecklistCategory)
    ? (categoryRaw as ChecklistCategory)
    : "tool";

  return { label, category };
}

export async function createChecklistItem(projectId: string, formData: FormData) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parseChecklistInput(formData);

  await db.insert(checklistItems).values({ projectId, ...input });

  revalidatePath(`/projects/${projectId}/checklist`);
}

export async function updateChecklistItem(
  itemId: string,
  projectId: string,
  formData: FormData
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const input = parseChecklistInput(formData);

  await db
    .update(checklistItems)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(checklistItems.id, itemId), eq(checklistItems.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/checklist`);
}

export async function deleteChecklistItem(itemId: string, projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  await db
    .delete(checklistItems)
    .where(and(eq(checklistItems.id, itemId), eq(checklistItems.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/checklist`);
}

// チェック状態をワンタップで反転させる
export async function toggleChecklistItem(itemId: string, projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const [current] = await db
    .select({ checked: checklistItems.checked })
    .from(checklistItems)
    .where(and(eq(checklistItems.id, itemId), eq(checklistItems.projectId, projectId)))
    .limit(1);
  if (!current) throw new Error("持ち物が見つかりません");

  await db
    .update(checklistItems)
    .set({ checked: !current.checked, updatedAt: new Date().toISOString() })
    .where(and(eq(checklistItems.id, itemId), eq(checklistItems.projectId, projectId)));

  revalidatePath(`/projects/${projectId}/checklist`);
}

// 買い出しリストの材料を持ち物リストへ一括インポートする。
// 重複判定は「現存する持ち物」の sourceIngredientId で行うため、既にインポート済みで
// まだ残っている材料はスキップし、重複登録しない。誤ってインポート項目を削除した場合は、
// 再度このボタンを押せば復元できる（ソフトデリートはせず、常に現存データで判定する追記型連携）。
export async function importFromShoppingList(
  projectId: string
): Promise<{ imported: number }> {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");

  const [{ items }, imported] = await Promise.all([
    getShoppingList(projectId),
    db
      .select({ sourceIngredientId: checklistItems.sourceIngredientId })
      .from(checklistItems)
      .where(and(eq(checklistItems.projectId, projectId), isNotNull(checklistItems.sourceIngredientId))),
  ]);

  const alreadyImported = new Set(imported.map((row) => row.sourceIngredientId));
  const toInsert = items
    .filter((item) => !alreadyImported.has(item.ingredientId))
    .map((item) => ({
      projectId,
      label: item.name,
      category: "ingredient" as const,
      memo: `${round1(item.neededQuantity)}${item.unit}・${item.lotsNeeded}個 ${formatYen(item.cost)}`,
      sourceIngredientId: item.ingredientId,
    }));

  if (toInsert.length > 0) {
    await db.insert(checklistItems).values(toInsert);
    revalidatePath(`/projects/${projectId}/checklist`);
  }

  return { imported: toInsert.length };
}
