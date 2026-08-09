// 採算シミュレーション（損益分岐点）の計算ロジック（DB非依存の純粋関数）。
//
// 「結局いくら儲かるのか」「何個売ればトントンなのか」を出す。
// AIには判断だけを任せ、金額と個数は必ずここで計算する（数字の出どころを1箇所に保つ）。
//
// 記号:
//   c_i = 1個あたり原価 / p_i = 販売価格 / m_i = 1個あたり利益 (p_i - c_i)
//   F   = かかるお金（固定費）の合計 / q_i = 販売個数 / T = 目標利益
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
  /** 逆算に使った目標利益。0 なら損益分岐点（＝赤字を防ぐ側）の答え */
  targetProfit:   number;
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

// パターン（採算のシナリオ）の明細1件分。保存するのは価格と個数だけで、
// 原価は保存しない（材料の値上がりを常に今の値で見たいため）
export type ScenarioLineInput = {
  recipeId:     string;
  sellingPrice: number;
  quantity:     number;
};

export type ScenarioLine = {
  recipeId:      string;
  name:          string;
  sellingPrice:  number;  // パターンの販売価格
  currentPrice:  number;  // 今のレシピの販売価格（パターンとの差を見せる）
  unitCost:      number;  // 材料マスタの最新値から計算した原価
  marginPerUnit: number;
  quantity:      number;
  subtotal:      number;  // m_i × q_i（この商品がどれだけ稼ぐか）
};

export type ScenarioResult = ScenarioProfit & {
  lines:         ScenarioLine[];
  /** 原価未登録で計算から外した商品 */
  excluded:      { recipeId: string; name: string }[];
  /** パターンを作った後に増えた商品（0個として扱っている） */
  unlisted:      { recipeId: string; name: string }[];
  totalQuantity: number;
  fixedCost:     number;
};

/**
 * 保存したパターンを、今の材料費で評価する。
 *
 * 明細ではなく「今あるレシピ」を軸に走査するので、
 * 商品が消えた明細は自然に落ち、後から増えた商品は0個として並ぶ。
 */
export function evaluateScenario(
  recipes: BreakevenRecipe[],
  items: ScenarioLineInput[],
  fixedCost: number
): ScenarioResult {
  const byRecipeId = new Map(items.map((i) => [i.recipeId, i]));

  // 原価未登録は利益を過大評価するため、損益分岐点と同じ方針で外す
  const excluded = recipes
    .filter((r) => !r.hasCost)
    .map((r) => ({ recipeId: r.recipeId, name: r.name }));
  const unlisted = recipes
    .filter((r) => r.hasCost && !byRecipeId.has(r.recipeId))
    .map((r) => ({ recipeId: r.recipeId, name: r.name }));

  const lines: ScenarioLine[] = recipes
    .filter((r) => r.hasCost)
    .map((r) => {
      const item          = byRecipeId.get(r.recipeId);
      const sellingPrice  = item?.sellingPrice ?? r.sellingPrice;
      const quantity      = item?.quantity ?? 0;
      const marginPerUnit = sellingPrice - r.unitCost;

      return {
        recipeId:     r.recipeId,
        name:         r.name,
        sellingPrice,
        currentPrice: r.sellingPrice,
        unitCost:     r.unitCost,
        marginPerUnit,
        quantity,
        subtotal:     marginPerUnit * quantity,
      };
    });

  return {
    ...calcScenarioProfit(lines, fixedCost),
    lines,
    excluded,
    unlisted,
    totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
    fixedCost,
  };
}

/**
 * 今の販売価格のまま、目標の手残りに届くには何個売ればよいかを求める。
 *
 * 商品ごとの個数は「今の作る予定数の構成比 r_i」を保ったまま全体をスケールする
 * （段取り＝仕込みのバランスを崩さないため）。
 *
 *   Σ(m_i × r_i × Q) = F + T  →  Q = (F + T) ÷ Σ(m_i × r_i),  q_i = ceil(r_i × Q)
 *
 * 目標利益 T を省くと T=0、つまり損益分岐点（＝赤字を防ぐ側）になる。
 * 「利益を読む」側と「赤字を防ぐ」側は同じ式の特殊ケースなので関数を分けない。
 */
export function calcBreakeven(
  recipes: BreakevenRecipe[],
  fixedCost: number,
  targetProfit: number = 0
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
    targetProfit,
    lines: baseLines.map((l) => ({ ...l, quantity: 0 })),
    excluded,
    totalQuantity: 0,
    revenue: 0,
    ingredientCost: 0,
    profit: status === "noFixedCost" ? 0 : -fixedCost,
  });

  // 売って回収すべき額。目標利益があれば、かかるお金が0でも売る意味がある
  const goal = fixedCost + targetProfit;

  if (baseLines.length === 0) return empty("noRecipes");
  if (!(goal > 0))            return empty("noFixedCost");

  // 全体を1個売るごとに増える平均利益。0以下なら売るほど赤字が増えるので解なし。
  // NaN との比較は常に false になるため `<= 0` ではなく「0より大きい」を肯定形で判定する。
  // こうしないと NaN が素通りして Math.ceil(x / NaN) = NaN を返し、画面に「NaN個」と出る
  const marginPerScale = baseLines.reduce((sum, l) => sum + l.marginPerUnit * l.ratio, 0);
  if (!(marginPerScale > 0)) return empty("unprofitable");

  const quantitiesFor = (scale: number) =>
    baseLines.map((l) => ({ ...l, quantity: Math.ceil(l.ratio * scale - EPSILON) }));

  let scale = goal / marginPerScale;
  let lines = quantitiesFor(scale);
  let totals = calcScenarioProfit(lines, fixedCost);

  // 商品ごとの切り上げは赤字商品を増やす方向にも働くため、
  // 目標に届いたと言いながら手残りが目標を下回ることがある。届くまで全体を1個ずつ増やす
  for (let i = 0; totals.profit < targetProfit && i < MAX_ADJUST; i++) {
    scale += 1;
    lines  = quantitiesFor(scale);
    totals = calcScenarioProfit(lines, fixedCost);
  }

  return {
    status: "ok",
    fixedCost,
    targetProfit,
    lines,
    excluded,
    totalQuantity:  lines.reduce((sum, l) => sum + l.quantity, 0),
    revenue:        totals.revenue,
    ingredientCost: totals.ingredientCost,
    profit:         totals.profit,
  };
}
