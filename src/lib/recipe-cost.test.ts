import { describe, expect, it } from "vitest";
import {
  calcRecipeCost,
  priceForTargetCostRate,
  quantityFromLineCost,
  round1,
  round2,
  roundUpTo,
  unitCostOf,
  type RecipeCostRow,
} from "@/lib/recipe-cost";

// 材料行のテスト用ファクトリ（必要な数値だけを上書きする）
function row(over: Partial<RecipeCostRow> = {}): RecipeCostRow {
  return {
    ingredientId:    "ing-1",
    ingredientName:  "小麦粉",
    unit:            "g",
    pricePerUnit:    200,   // 200円で
    quantityPerUnit: 1000,  // 1000g 買える → 1gあたり0.2円
    quantityUsed:    100,   // 1個に100g使う → 20円
    ...over,
  };
}

describe("unitCostOf", () => {
  it("購入単価 ÷ 購入数量 を返す", () => {
    expect(unitCostOf(200, 1000)).toBeCloseTo(0.2);
  });

  it("購入数量が0ならゼロ除算せず0を返す", () => {
    expect(unitCostOf(200, 0)).toBe(0);
  });
});

describe("calcRecipeCost", () => {
  it("材料が未登録なら原価0・利益は販売価格まるごとになる", () => {
    const cost = calcRecipeCost(300, []);
    expect(cost.totalCost).toBe(0);
    expect(cost.profit).toBe(300);
    expect(cost.profitRate).toBe(100);
    expect(cost.costRate).toBe(0);
    expect(cost.lines).toEqual([]);
  });

  it("材料ごとの原価を積み上げて利益率・原価率を出す", () => {
    // 20円 + 30円 = 原価50円、販売価格200円 → 利益150円・利益率75%・原価率25%
    const cost = calcRecipeCost(200, [
      row(),
      row({ ingredientId: "ing-2", pricePerUnit: 300, quantityPerUnit: 100, quantityUsed: 10 }),
    ]);
    expect(cost.totalCost).toBeCloseTo(50);
    expect(cost.profit).toBeCloseTo(150);
    expect(cost.profitRate).toBeCloseTo(75);
    expect(cost.costRate).toBeCloseTo(25);
    expect(cost.lines.map((l) => l.lineCost)).toEqual([20, 30]);
  });

  it("原価が販売価格を上回ると利益がマイナス（赤字）になる", () => {
    // 原価20円に対して販売価格10円
    const cost = calcRecipeCost(10, [row()]);
    expect(cost.profit).toBeCloseTo(-10);
    expect(cost.profitRate).toBeLessThan(0);
    expect(cost.costRate).toBeCloseTo(200);
  });

  it("販売価格が0でも率の計算でゼロ除算しない", () => {
    const cost = calcRecipeCost(0, [row()]);
    expect(cost.profitRate).toBe(0);
    expect(cost.costRate).toBe(0);
    expect(cost.profit).toBeCloseTo(-20);
  });

  it("元の材料行の情報を lines に保ったまま lineCost を足す", () => {
    const [line] = calcRecipeCost(200, [row()]).lines;
    expect(line.ingredientName).toBe("小麦粉");
    expect(line.unit).toBe("g");
    expect(line.lineCost).toBeCloseTo(20);
  });
});

describe("priceForTargetCostRate", () => {
  it("目標原価率30%なら 原価 ÷ 0.3 の価格を返す", () => {
    expect(priceForTargetCostRate(60, 30)).toBeCloseTo(200);
  });

  it("原価0・目標0以下では0を返す（防御）", () => {
    expect(priceForTargetCostRate(0, 30)).toBe(0);
    expect(priceForTargetCostRate(60, 0)).toBe(0);
    expect(priceForTargetCostRate(60, -10)).toBe(0);
  });
});

describe("quantityFromLineCost", () => {
  it("材料費から使用量を逆算する（1gあたり0.2円で20円 → 100g）", () => {
    expect(quantityFromLineCost(20, 200, 1000)).toBeCloseTo(100);
  });

  it("単位あたり原価が0なら0を返す（防御）", () => {
    expect(quantityFromLineCost(20, 200, 0)).toBe(0);
  });
});

describe("丸めヘルパー", () => {
  it("round1 は小数第1位まで、round2 は第2位まで丸める", () => {
    expect(round1(2.44)).toBe(2.4);
    expect(round1(2.45)).toBe(2.5);
    expect(round2(1.005)).toBe(1.0);
    expect(round2(1.006)).toBe(1.01);
  });

  it("roundUpTo は step の倍数に切り上げる", () => {
    expect(roundUpTo(101, 50)).toBe(150);
    expect(roundUpTo(100, 50)).toBe(100);
  });
});
