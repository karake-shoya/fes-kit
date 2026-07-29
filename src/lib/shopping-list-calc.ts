// 買い出しリストの積算ロジック（DB非依存の純粋関数）。
// 「レシピの作る予定数 × 材料の使用量」を材料ごとに合算し、購入ロット数と費用を出す。
// DBクエリ（src/db/queries/shopping-list.ts）から計算だけを切り出してテスト可能にしている。

// 積算の入力となる1行（レシピ×材料の組み合わせ）
export type ShoppingListSourceRow = {
  ingredientId:    string;
  name:            string;
  unit:            string;
  quantityPerUnit: number; // 1ロットの内容量
  pricePerUnit:    number; // 1ロットの価格
  quantityUsed:    number; // 商品1個あたりの使用量
  servings:        number; // そのレシピの作る予定数
};

// 買い出しリストの1材料分
export type ShoppingListItem = {
  ingredientId:    string;
  name:            string;
  unit:            string;
  neededQuantity:  number; // 全レシピ分の必要合計使用量
  quantityPerUnit: number; // 1ロットの内容量
  pricePerUnit:    number; // 1ロットの価格
  lotsNeeded:      number; // 買うべきロット数
  cost:            number; // lotsNeeded × pricePerUnit
};

// 材料ごとに必要量を積算し、費用の高い順に並べて返す。
// 在庫管理はしないため、必要量は常にゼロからの購入量として計算する
// （新規イベントの買い出し計画という前提）。
export function calcShoppingList(rows: ShoppingListSourceRow[]): {
  items: ShoppingListItem[];
  totalCost: number;
} {
  // ingredientId ごとに必要量を積算する
  const byIngredient = new Map<
    string,
    { name: string; unit: string; quantityPerUnit: number; pricePerUnit: number; neededQuantity: number }
  >();

  for (const row of rows) {
    const acc = byIngredient.get(row.ingredientId) ?? {
      name:            row.name,
      unit:            row.unit,
      quantityPerUnit: row.quantityPerUnit,
      pricePerUnit:    row.pricePerUnit,
      neededQuantity:  0,
    };
    acc.neededQuantity += row.quantityUsed * row.servings;
    byIngredient.set(row.ingredientId, acc);
  }

  const items: ShoppingListItem[] = Array.from(byIngredient.entries())
    .map(([ingredientId, acc]) => {
      // quantityPerUnit が0以下の材料は購入ロットを計算できないため0扱いにする（ゼロ除算防止）。
      // 除算前に微小なイプシロンを引き、浮動小数点の丸め誤差（例: 6.300000000000001）で
      // ちょうど整数倍のはずの値が繰り上がってロット数を1つ多く見積もるのを防ぐ。
      const lotsNeeded = acc.quantityPerUnit > 0
        ? Math.ceil(acc.neededQuantity / acc.quantityPerUnit - 1e-9)
        : 0;
      const cost = lotsNeeded * acc.pricePerUnit;

      return {
        ingredientId,
        name:            acc.name,
        unit:            acc.unit,
        neededQuantity:  acc.neededQuantity,
        quantityPerUnit: acc.quantityPerUnit,
        pricePerUnit:    acc.pricePerUnit,
        lotsNeeded,
        cost,
      };
    })
    .sort((a, b) => b.cost - a.cost);

  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

  return { items, totalCost };
}
