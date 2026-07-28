import { describe, expect, it } from "vitest";
import { groupChecklistItemsByCategory } from "@/lib/checklist";
import type { ChecklistItem } from "@/db/schema";

// 持ち物1件のテスト用ファクトリ
function item(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id:        "c-1",
    projectId: "p-1",
    label:     "鉄板",
    category:  "tool",
    checked:   false,
    memo:      null,
    sourceIngredientId: null,
    createdAt: "2026-07-01 00:00:00",
    updatedAt: "2026-07-01 00:00:00",
    ...over,
  };
}

describe("groupChecklistItemsByCategory", () => {
  it("道具→材料→書類 の順で返す", () => {
    const groups = groupChecklistItemsByCategory([
      item({ id: "a", category: "document" }),
      item({ id: "b", category: "ingredient" }),
      item({ id: "c", category: "tool" }),
    ]);
    expect(groups.map(([category]) => category)).toEqual(["tool", "ingredient", "document"]);
  });

  it("グループ内は 未チェック→チェック済み の順に並べる", () => {
    const [[, items]] = groupChecklistItemsByCategory([
      item({ id: "a", checked: true }),
      item({ id: "b", checked: false }),
      item({ id: "c", checked: true }),
      item({ id: "d", checked: false }),
    ]);
    // 同じチェック状態の中では元の並び（作成順）を保つ
    expect(items.map((i) => i.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("0件のカテゴリは返さない", () => {
    const groups = groupChecklistItemsByCategory([item({ category: "tool" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("tool");
  });

  it("空リストなら空配列を返す", () => {
    expect(groupChecklistItemsByCategory([])).toEqual([]);
  });
});
