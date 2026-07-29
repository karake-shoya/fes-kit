import { describe, expect, it } from "vitest";
import {
  calcBreakeven,
  calcScenarioProfit,
  calcPurchaseRate,
  evaluateScenario,
  sumExpenses,
  type BreakevenRecipe,
} from "@/lib/breakeven";

// 商品1件のテスト用ファクトリ（1個300円・原価100円・100個作る予定）
function recipe(over: Partial<BreakevenRecipe> = {}): BreakevenRecipe {
  return {
    recipeId:     "r-1",
    name:         "たこ焼き",
    sellingPrice: 300,
    unitCost:     100,
    servings:     100,
    hasCost:      true,
    ...over,
  };
}

describe("sumExpenses", () => {
  it("かかるお金の金額を合計する", () => {
    expect(sumExpenses([{ amount: 5000 }, { amount: 3000 }, { amount: 1200 }])).toBe(9200);
  });

  it("1件も無ければ0", () => {
    expect(sumExpenses([])).toBe(0);
  });
});

describe("calcBreakeven", () => {
  it("1商品なら 固定費 ÷ 1個あたり利益 の個数でトントンになる", () => {
    // 利益200円/個、固定費5000円 → 25個
    const result = calcBreakeven([recipe()], 5000);

    expect(result.status).toBe("ok");
    expect(result.totalQuantity).toBe(25);
    expect(result.lines[0].quantity).toBe(25);
    expect(result.profit).toBe(0);
  });

  it("割り切れないときは1個多く売る側に切り上げる", () => {
    // 利益150円/個、固定費5000円 → 33.33個 → 34個（利益100円）
    const result = calcBreakeven([recipe({ sellingPrice: 250 })], 5000);

    expect(result.totalQuantity).toBe(34);
    expect(result.profit).toBe(100);
  });

  it("複数商品は今の作る予定数の構成比を保ったままスケールする", () => {
    // たこ焼き100個(利益200) : 焼きそば50個(利益100) = 2:1 の比率を保つ
    // 平均利益 = 200×(2/3) + 100×(1/3) ≒ 166.67 → 固定費10000円なら全体60個
    const result = calcBreakeven(
      [
        recipe(),
        recipe({ recipeId: "r-2", name: "焼きそば", sellingPrice: 200, unitCost: 100, servings: 50 }),
      ],
      10000
    );

    expect(result.totalQuantity).toBe(60);
    const [takoyaki, yakisoba] = result.lines;
    expect(takoyaki.quantity).toBe(40);
    expect(yakisoba.quantity).toBe(20);
    expect(result.profit).toBe(0);
  });

  it("作る予定数が全て0なら均等に配分する", () => {
    const result = calcBreakeven(
      [
        recipe({ servings: 0 }),
        recipe({ recipeId: "r-2", name: "焼きそば", servings: 0 }),
      ],
      10000
    );

    expect(result.lines[0].ratio).toBeCloseTo(0.5);
    expect(result.lines[1].ratio).toBeCloseTo(0.5);
    // 利益200円/個、固定費10000円 → 全体50個を均等に25個ずつ
    expect(result.lines.map((l) => l.quantity)).toEqual([25, 25]);
  });

  it("原価未登録の商品は計算から除外して名前を返す", () => {
    // 除外しないと原価0円＝利益300円として過大評価される
    const result = calcBreakeven(
      [
        recipe(),
        recipe({ recipeId: "r-2", name: "わたあめ", hasCost: false, unitCost: 0 }),
      ],
      5000
    );

    expect(result.lines).toHaveLength(1);
    expect(result.excluded.map((e) => e.name)).toEqual(["わたあめ"]);
    expect(result.totalQuantity).toBe(25);
  });

  it("全商品が赤字なら解なしとして扱う", () => {
    // 販売価格80円 < 原価100円 → 売るほど赤字が増える
    const result = calcBreakeven([recipe({ sellingPrice: 80 })], 5000);

    expect(result.status).toBe("unprofitable");
    expect(result.totalQuantity).toBe(0);
  });

  it("1個あたり利益がちょうど0でも解なしとして扱う", () => {
    const result = calcBreakeven([recipe({ sellingPrice: 100 })], 5000);

    expect(result.status).toBe("unprofitable");
  });

  it("かかるお金が未登録なら損益分岐点ではなく案内に切り替える", () => {
    const result = calcBreakeven([recipe()], 0);

    expect(result.status).toBe("noFixedCost");
    expect(result.totalQuantity).toBe(0);
  });

  it("計算できる商品が1件も無ければ商品なしとして扱う", () => {
    expect(calcBreakeven([], 5000).status).toBe("noRecipes");
    expect(calcBreakeven([recipe({ hasCost: false })], 5000).status).toBe("noRecipes");
  });

  it("赤字商品が混ざっていても、切り上げ後の利益がマイナスにならない個数を返す", () => {
    // 構成比のわずかな赤字商品(利益-500)も切り上げで必ず1個は売る形になるため、
    // 単純な切り上げだけだと「トントン」と言いながら利益が沈む
    const result = calcBreakeven(
      [
        recipe({ sellingPrice: 300, unitCost: 200, servings: 95 }),
        recipe({ recipeId: "r-2", name: "特製セット", sellingPrice: 100, unitCost: 600, servings: 5 }),
      ],
      200
    );

    expect(result.status).toBe("ok");
    expect(result.profit).toBeGreaterThanOrEqual(0);
  });

  it("販売価格・原価・個数から利益の内訳を出す", () => {
    const result = calcBreakeven([recipe()], 5000);

    // 25個 × 300円 = 7500円、原価 25個 × 100円 = 2500円
    expect(result.revenue).toBe(7500);
    expect(result.ingredientCost).toBe(2500);
    expect(result.fixedCost).toBe(5000);
  });
});

describe("calcScenarioProfit", () => {
  it("好きな価格・個数を当てはめたときの利益を計算する", () => {
    // (300-100)×30 + (200-100)×20 = 8000円、固定費5000円 → 3000円
    const result = calcScenarioProfit(
      [
        { sellingPrice: 300, unitCost: 100, quantity: 30 },
        { sellingPrice: 200, unitCost: 100, quantity: 20 },
      ],
      5000
    );

    expect(result.revenue).toBe(13000);
    expect(result.ingredientCost).toBe(5000);
    expect(result.grossProfit).toBe(8000);
    expect(result.profit).toBe(3000);
  });

  it("固定費を回収できていなければ利益はマイナスになる", () => {
    const result = calcScenarioProfit([{ sellingPrice: 300, unitCost: 100, quantity: 10 }], 5000);

    expect(result.profit).toBe(-3000);
  });

  it("商品が無ければ売上も利益も固定費ぶんのマイナスになる", () => {
    expect(calcScenarioProfit([], 5000)).toEqual({
      revenue: 0,
      ingredientCost: 0,
      grossProfit: 0,
      profit: -5000,
    });
  });
});

describe("evaluateScenario", () => {
  it("パターンの価格・個数で手残りを計算する", () => {
    // (400-100)×30 = 9000円、固定費5000円 → 4000円
    const result = evaluateScenario(
      [recipe()],
      [{ recipeId: "r-1", sellingPrice: 400, quantity: 30 }],
      5000
    );

    expect(result.totalQuantity).toBe(30);
    expect(result.revenue).toBe(12000);
    expect(result.ingredientCost).toBe(3000);
    expect(result.profit).toBe(4000);
    expect(result.lines[0].sellingPrice).toBe(400);
  });

  it("原価はパターンではなく材料マスタの今の値を使う", () => {
    // 材料が値上がりして原価が100→250になったら、同じパターンでも利益は減る
    const result = evaluateScenario(
      [recipe({ unitCost: 250 })],
      [{ recipeId: "r-1", sellingPrice: 400, quantity: 30 }],
      0
    );

    expect(result.lines[0].unitCost).toBe(250);
    expect(result.lines[0].marginPerUnit).toBe(150);
    expect(result.profit).toBe(4500);
  });

  it("今のレシピの価格も返して、パターンとの差が分かるようにする", () => {
    const result = evaluateScenario(
      [recipe({ sellingPrice: 300 })],
      [{ recipeId: "r-1", sellingPrice: 400, quantity: 30 }],
      0
    );

    expect(result.lines[0].currentPrice).toBe(300);
    expect(result.lines[0].sellingPrice).toBe(400);
  });

  it("パターンに入っていない商品は0個として扱い、名前を知らせる", () => {
    // パターンを作った後に商品が増えたケース。黙って無視すると数字の理由が分からない
    const result = evaluateScenario(
      [recipe(), recipe({ recipeId: "r-2", name: "焼きそば" })],
      [{ recipeId: "r-1", sellingPrice: 400, quantity: 30 }],
      5000
    );

    expect(result.unlisted.map((u) => u.name)).toEqual(["焼きそば"]);
    const yakisoba = result.lines.find((l) => l.recipeId === "r-2");
    expect(yakisoba?.quantity).toBe(0);
    // 0個なので利益には効かない
    expect(result.profit).toBe(4000);
  });

  it("削除された商品の明細は無視する", () => {
    const result = evaluateScenario(
      [recipe()],
      [
        { recipeId: "r-1", sellingPrice: 400, quantity: 30 },
        { recipeId: "deleted", sellingPrice: 500, quantity: 100 },
      ],
      0
    );

    expect(result.lines).toHaveLength(1);
    expect(result.totalQuantity).toBe(30);
  });

  it("原価未登録の商品は計算から除外して名前を返す", () => {
    const result = evaluateScenario(
      [recipe(), recipe({ recipeId: "r-2", name: "わたあめ", hasCost: false, unitCost: 0 })],
      [
        { recipeId: "r-1", sellingPrice: 400, quantity: 30 },
        { recipeId: "r-2", sellingPrice: 200, quantity: 50 },
      ],
      5000
    );

    expect(result.lines).toHaveLength(1);
    expect(result.excluded.map((e) => e.name)).toEqual(["わたあめ"]);
    expect(result.totalQuantity).toBe(30);
    expect(result.profit).toBe(4000);
  });

  it("原価割れの商品は1個あたり利益がマイナスのまま合計に効く", () => {
    // 黙って除外すると「このパターンなら黒字」という嘘になるため、赤字のまま数える
    const result = evaluateScenario(
      [recipe(), recipe({ recipeId: "r-2", name: "特製セット", unitCost: 600 })],
      [
        { recipeId: "r-1", sellingPrice: 400, quantity: 30 },
        { recipeId: "r-2", sellingPrice: 500, quantity: 10 },
      ],
      0
    );

    const set = result.lines.find((l) => l.recipeId === "r-2");
    expect(set?.marginPerUnit).toBe(-100);
    // 9000 + (-1000) = 8000
    expect(result.profit).toBe(8000);
  });

  it("商品が1件も無ければ固定費ぶんのマイナスになる", () => {
    const result = evaluateScenario([], [], 5000);

    expect(result.lines).toEqual([]);
    expect(result.totalQuantity).toBe(0);
    expect(result.profit).toBe(-5000);
  });
});

describe("calcPurchaseRate", () => {
  it("販売個数 ÷ 想定来場者数 を返す", () => {
    expect(calcPurchaseRate(200, 500)).toBe(0.4);
  });

  it("来場者全員が1個以上買う前提になっていたら1を超える", () => {
    expect(calcPurchaseRate(600, 500)).toBe(1.2);
  });

  it("想定来場者数が未入力・0なら判定できないので null を返す", () => {
    expect(calcPurchaseRate(200, null)).toBeNull();
    expect(calcPurchaseRate(200, 0)).toBeNull();
  });
});
