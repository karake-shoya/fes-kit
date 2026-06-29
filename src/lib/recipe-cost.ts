// レシピの原価・利益・利益率を計算する純粋ロジック（DB非依存）
// クライアント（スライダー操作中の即時再計算）とサーバー（DBクエリ）の両方から
// 利用するため、drizzle/db をimportしないこのファイルに集約する。

// 利益率計算に必要な材料行の型
export type RecipeCostRow = {
  ingredientId:    string;
  ingredientName:  string;
  unit:            string;
  pricePerUnit:    number;   // 材料の購入単価
  quantityPerUnit: number;   // 購入数量（この金額で買える量）
  quantityUsed:    number;   // 商品1個あたりの使用量
};

export type RecipeCost = {
  totalCost:  number;   // 1個あたり原価
  profit:     number;   // 1個あたり利益
  profitRate: number;   // 利益率（%）
  lines: (RecipeCostRow & { lineCost: number })[]; // 材料ごとの原価
};

// 数値の丸めヘルパー（クライアントの入力・スライダーで共用）
// 使用量は小数第一位まで（例: 2.5, 0.3）、最小単位は 0.1。
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;
// step の倍数に切り上げる（スライダー上限の算出に使う）
export const roundUpTo = (n: number, step: number) => Math.ceil(n / step) * step;

// 材料1単位あたりの原価（購入単価 ÷ 購入数量）
// quantityPerUnit が 0 のときはゼロ除算を避け 0 を返す（防御）
export function unitCostOf(pricePerUnit: number, quantityPerUnit: number): number {
  return quantityPerUnit > 0 ? pricePerUnit / quantityPerUnit : 0;
}

// 材料費（lineCost）から使用量を逆算する（⑤の逆算モード用）
// 使用量 = 材料費 ÷ 単位あたり原価
export function quantityFromLineCost(
  lineCost: number,
  pricePerUnit: number,
  quantityPerUnit: number
): number {
  const unitCost = unitCostOf(pricePerUnit, quantityPerUnit);
  return unitCost > 0 ? lineCost / unitCost : 0;
}

// 原価・利益・利益率を計算する純粋関数（一覧・詳細・クライアントで共用）
// 計算方針: 使用量・販売価格はいずれも「商品1個分」。servingsは計算に使わない。
export function calcRecipeCost(sellingPrice: number, rows: RecipeCostRow[]): RecipeCost {
  const lines = rows.map((row) => {
    // 1材料あたり原価 = (購入単価 ÷ 購入数量) × 使用量
    const lineCost = unitCostOf(row.pricePerUnit, row.quantityPerUnit) * row.quantityUsed;
    return { ...row, lineCost };
  });

  const totalCost  = lines.reduce((sum, l) => sum + l.lineCost, 0);
  const profit     = sellingPrice - totalCost;
  const profitRate = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  return { totalCost, profit, profitRate, lines };
}
