import { describe, expect, it } from "vitest";
import { calcShoppingList, type ShoppingListSourceRow } from "@/lib/shopping-list-calc";

// レシピ×材料1行のテスト用ファクトリ
function sourceRow(over: Partial<ShoppingListSourceRow> = {}): ShoppingListSourceRow {
  return {
    ingredientId:    "ing-1",
    name:            "キャベツ",
    unit:            "g",
    quantityPerUnit: 1000, // 1玉1000g
    pricePerUnit:    200,  // 1玉200円
    quantityUsed:    30,   // 1皿30g
    servings:        100,  // 100皿作る
    ...over,
  };
}

describe("calcShoppingList", () => {
  it("使用量 × 作る予定数 を必要量とし、ロット単位に切り上げて費用を出す", () => {
    // 30g × 100皿 = 3000g 必要 → 1000g入りを3個 → 600円
    const { items, totalCost } = calcShoppingList([sourceRow()]);
    expect(items).toHaveLength(1);
    expect(items[0].neededQuantity).toBe(3000);
    expect(items[0].lotsNeeded).toBe(3);
    expect(items[0].cost).toBe(600);
    expect(totalCost).toBe(600);
  });

  it("端数が出たら1ロット多く買う", () => {
    // 30g × 101皿 = 3030g → 4個必要
    const { items } = calcShoppingList([sourceRow({ servings: 101 })]);
    expect(items[0].lotsNeeded).toBe(4);
  });

  it("複数レシピで同じ材料を使う場合は必要量を合算する", () => {
    // 3000g + 1000g = 4000g → ちょうど4個
    const { items } = calcShoppingList([
      sourceRow(),
      sourceRow({ quantityUsed: 20, servings: 50 }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].neededQuantity).toBe(4000);
    expect(items[0].lotsNeeded).toBe(4);
  });

  it("浮動小数点の誤差でロットを1つ多く見積もらない", () => {
    // 0.1 × 3 は 0.30000000000000004 になるが、1ロット0.3 なら1個で足りる
    const { items } = calcShoppingList([
      sourceRow({ quantityPerUnit: 0.3, quantityUsed: 0.1, servings: 3 }),
    ]);
    expect(items[0].lotsNeeded).toBe(1);
  });

  it("購入数量が0の材料はゼロ除算せずロット0・費用0にする", () => {
    const { items, totalCost } = calcShoppingList([sourceRow({ quantityPerUnit: 0 })]);
    expect(items[0].lotsNeeded).toBe(0);
    expect(items[0].cost).toBe(0);
    expect(totalCost).toBe(0);
  });

  it("費用の高い順に並べ、合計費用を返す", () => {
    const { items, totalCost } = calcShoppingList([
      sourceRow({ ingredientId: "cheap", name: "塩", quantityPerUnit: 1000, pricePerUnit: 100, quantityUsed: 1, servings: 100 }),
      sourceRow({ ingredientId: "pricey", name: "豚肉", quantityPerUnit: 500, pricePerUnit: 900, quantityUsed: 50, servings: 100 }),
    ]);
    expect(items.map((i) => i.name)).toEqual(["豚肉", "塩"]);
    // 豚肉: 5000g必要 → 10個 → 9000円 / 塩: 100g必要 → 1個 → 100円
    expect(totalCost).toBe(9100);
  });

  it("材料が1件も無ければ空リストと合計0を返す", () => {
    expect(calcShoppingList([])).toEqual({ items: [], totalCost: 0 });
  });
});
