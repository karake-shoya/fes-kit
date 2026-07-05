import type { ChecklistItem } from "@/db/schema";

// カテゴリ表示定義（CLAUDE.md準拠）
export const CATEGORY_STYLE = {
  tool:       { label: "道具" },
  ingredient: { label: "材料" },
  document:   { label: "書類" },
} as const;

export type ChecklistCategory = keyof typeof CATEGORY_STYLE;

// 画面に表示するカテゴリの並び順
export const CATEGORY_ORDER: ChecklistCategory[] = ["tool", "ingredient", "document"];

// カテゴリでグループ化する（CATEGORY_ORDER の順で返す）。
// 各グループ内は未チェック→チェック済みの順、同チェック状態内は元の安定順（作成順）を保つ。
// 該当項目が0件のカテゴリは返さない。
export function groupChecklistItemsByCategory(
  list: ChecklistItem[]
): [ChecklistCategory, ChecklistItem[]][] {
  return CATEGORY_ORDER.map((category) => {
    const items = list
      .filter((item) => item.category === category)
      .sort((a, b) => Number(a.checked) - Number(b.checked));
    return [category, items] as [ChecklistCategory, ChecklistItem[]];
  }).filter(([, items]) => items.length > 0);
}
