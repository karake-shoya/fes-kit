// 採算シミュレーション（損益分岐点）の計算ロジック（DB非依存の純粋関数）。
//
// 「結局いくら儲かるのか」「何個売ればトントンなのか」を出す。
// AIには判断だけを任せ、金額と個数は必ずここで計算する（数字の出どころを1箇所に保つ）。
//
// 記号:
//   c_i = 1個あたり原価 / p_i = 販売価格 / m_i = 1個あたり利益 (p_i - c_i)
//   F   = かかるお金（固定費）の合計 / q_i = 販売個数
//   利益 = Σ(m_i × q_i) − F

// 浮動小数点の丸め誤差（例: 39.999999999999996）で個数を1つ多く見積もらないための遊び。
// 買い出しリストの積算（lib/shopping-list-calc.ts）と同じ考え方。
const EPSILON = 1e-9;

// 切り上げの影響で利益が負に沈んだときに、全体個数を1個ずつ増やして
// 黒字へ戻す試行の上限。1個あたり平均利益が正の場合しか呼ばれないため必ず収束するが、
// 想定外の入力で無限ループにならないよう上限を置く
const MAX_ADJUST = 1000;

// 計算に使う商品1件分
export type BreakevenRecipe = {
  recipeId:     string;
  name:         string;
  sellingPrice: number;  // p_i
  unitCost:     number;  // c_i（calcRecipeCost().totalCost）
  servings:     number;  // 今の「作る予定数」。商品どうしの構成比を決めるのに使う
  /** 材料が登録されているか。false は原価0＝利益を過大評価するため計算から外す */
  hasCost:      boolean;
};

// 計算に含めた商品1件分の結果
export type BreakevenLine = BreakevenRecipe & {
  marginPerUnit: number; // m_i
  ratio:         number; // r_i（作る予定数の構成比）
  quantity:      number; // q_i（トントンに必要な販売個数）
};

export type BreakevenStatus =
  | "ok"            // 損益分岐点を計算できた
  | "noRecipes"     // 計算できる商品が無い（未登録 or 全て原価未登録）
  | "noFixedCost"   // かかるお金が未登録。回収すべき金額が無いので分岐点を出さない
  | "unprofitable"; // 平均の1個あたり利益が0以下。何個売っても回収できない

export type BreakevenResult = {
  status:         BreakevenStatus;
  fixedCost:      number;
  lines:          BreakevenLine[];
  /** 原価未登録で計算から外した商品（画面で理由を明示するため名前を返す） */
  excluded:       { recipeId: string; name: string }[];
  totalQuantity:  number;             // Σ q_i
  revenue:        number;             // Σ (p_i × q_i)
  ingredientCost: number;             // Σ (c_i × q_i)
  profit:         number;             // Σ (m_i × q_i) − F
};

// 好きな価格・個数を当てはめたときの損益。損益分岐点の検算にも、
// AI提案の検算（提案どおりに売っても赤字ではないか）にも使う
export type ScenarioItem = {
  sellingPrice: number;
  unitCost:     number;
  quantity:     number;
};

export type ScenarioProfit = {
  revenue:        number;
  ingredientCost: number;
  grossProfit:    number; // 固定費を引く前（材料費だけを引いた利益）
  profit:         number; // 固定費まで引いた手残り
};

/** かかるお金の合計（F） */
export function sumExpenses(expenses: { amount: number }[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function calcScenarioProfit(items: ScenarioItem[], fixedCost: number): ScenarioProfit {
  const revenue        = items.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const ingredientCost = items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
  const grossProfit    = revenue - ingredientCost;

  return { revenue, ingredientCost, grossProfit, profit: grossProfit - fixedCost };
}

/**
 * 購入率（販売個数 ÷ 想定来場者数）。
 * 1を超える＝来場者全員が1個以上買う前提なので、画面側で警告する。
 * 想定来場者数が未入力・0なら判定できないため null を返す。
 */
export function calcPurchaseRate(
  totalQuantity: number,
  expectedVisitors: number | null | undefined
): number | null {
  if (!expectedVisitors || expectedVisitors <= 0) return null;
  return totalQuantity / expectedVisitors;
}

/**
 * 今の販売価格のまま、かかるお金を回収するには何個売ればよいかを求める。
 *
 * 商品ごとの個数は「今の作る予定数の構成比 r_i」を保ったまま全体をスケールする
 * （段取り＝仕込みのバランスを崩さないため）。
 *
 *   Σ(m_i × r_i × Q) = F  →  Q = F ÷ Σ(m_i × r_i),  q_i = ceil(r_i × Q)
 */
export function calcBreakeven(
  recipes: BreakevenRecipe[],
  fixedCost: number
): BreakevenResult {
  // 原価未登録は利益を過大評価するため計算から外す（実績ページと同じ方針）
  const targets  = recipes.filter((r) => r.hasCost);
  const excluded = recipes
    .filter((r) => !r.hasCost)
    .map((r) => ({ recipeId: r.recipeId, name: r.name }));

  // 作る予定数の構成比。全て0（未入力）なら均等配分にフォールバックする
  const servingsTotal = targets.reduce((sum, r) => sum + Math.max(0, r.servings), 0);
  const baseLines = targets.map((r) => ({
    ...r,
    marginPerUnit: r.sellingPrice - r.unitCost,
    ratio: servingsTotal > 0 ? Math.max(0, r.servings) / servingsTotal : 1 / targets.length,
  }));

  const empty = (status: BreakevenStatus): BreakevenResult => ({
    status,
    fixedCost,
    lines: baseLines.map((l) => ({ ...l, quantity: 0 })),
    excluded,
    totalQuantity: 0,
    revenue: 0,
    ingredientCost: 0,
    profit: status === "noFixedCost" ? 0 : -fixedCost,
  });

  if (baseLines.length === 0) return empty("noRecipes");
  if (fixedCost <= 0)         return empty("noFixedCost");

  // 全体を1個売るごとに増える平均利益。0以下なら売るほど赤字が増えるので解なし
  const marginPerScale = baseLines.reduce((sum, l) => sum + l.marginPerUnit * l.ratio, 0);
  if (marginPerScale <= 0) return empty("unprofitable");

  const quantitiesFor = (scale: number) =>
    baseLines.map((l) => ({ ...l, quantity: Math.ceil(l.ratio * scale - EPSILON) }));

  let scale = fixedCost / marginPerScale;
  let lines = quantitiesFor(scale);
  let totals = calcScenarioProfit(lines, fixedCost);

  // 商品ごとの切り上げは赤字商品を増やす方向にも働くため、
  // 「トントン」と言いながら利益が負に沈むことがある。黒字に戻るまで全体を1個ずつ増やす
  for (let i = 0; totals.profit < 0 && i < MAX_ADJUST; i++) {
    scale += 1;
    lines  = quantitiesFor(scale);
    totals = calcScenarioProfit(lines, fixedCost);
  }

  return {
    status: "ok",
    fixedCost,
    lines,
    excluded,
    totalQuantity:  lines.reduce((sum, l) => sum + l.quantity, 0),
    revenue:        totals.revenue,
    ingredientCost: totals.ingredientCost,
    profit:         totals.profit,
  };
}
