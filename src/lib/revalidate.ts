import { revalidatePath } from "next/cache";

// プロジェクト配下の画面キャッシュ再検証を1箇所にまとめる。
//
// 各アクションが影響画面を手書きで列挙していると、
// 「材料の単価を変えたのにレシピの原価率が古いまま」のような取りこぼしが起きる。
// ここでは「どのデータを触ったか」だけを渡してもらい、
// 波及先の画面はこの対応表が決める（データ間の依存を書く場所を1つにする）。

// 触ったデータの種類
export type ProjectData =
  | "project"      // プロジェクト本体（名前・イベント日）
  | "ingredients"  // 材料マスタ
  | "recipes"      // レシピ本体・レシピの材料構成
  | "schedules"    // スケジュール
  | "checklist"    // 持ち物・準備チェックリスト
  | "prototypes"   // 試作記録
  | "salesRecords" // 当日の売上・実績
  | "expenses";    // かかるお金（固定費）

// プロジェクト配下の画面
type Screen =
  | "home" | "settings" | "ingredients" | "recipes" | "recipeDetail"
  | "shoppingList" | "checklist" | "schedule" | "prototypes" | "results"
  | "expenses" | "simulation";

// データ → 影響を受ける画面
const AFFECTED_SCREENS: Record<ProjectData, Screen[]> = {
  // 想定来場者数は採算シミュレーションの購入率判定に効く
  project:     ["home", "settings", "simulation"],
  // 材料の単価・購入数量はレシピの原価、買い出しの必要量、実績の利益にそのまま効く
  ingredients: ["ingredients", "recipes", "recipeDetail", "shoppingList", "results", "home", "simulation"],
  // レシピの販売価格・作る予定数・材料構成も同じ範囲に波及する（ホームは赤字商品の警告とバッジ）
  recipes:     ["recipes", "recipeDetail", "shoppingList", "results", "home", "simulation"],
  // ホームの「準備の進みぐあい」「次にやること」はスケジュールの完了数を見ている
  schedules:   ["schedule", "home"],
  // ホームの進捗バーは持ち物のチェック数も合算している
  checklist:   ["checklist", "home"],
  prototypes:  ["prototypes"],
  // 実績ページ自身は意図的に再検証しない。カードがローカルstateで最新値を表示しており、
  // 保存のたびに再レンダーが返ると連打編集中の値が古いサーバー値へ巻き戻るため
  // （再訪時は動的レンダーで整合する）。ホームのバッジだけ更新する。
  salesRecords: ["home"],
  // かかるお金は損益分岐点の分子そのもの。ホームのカードにも合計を出している
  expenses:     ["expenses", "simulation", "home"],
};

// 再検証するパスと、その範囲（page = そのページだけ / layout = 配下のページも含む）
type Target = { path: string; type?: "layout" };

function targetOf(screen: Screen, projectId: string, recipeId?: string): Target {
  const base = `/projects/${projectId}`;
  switch (screen) {
    case "home":          return { path: base };
    case "settings":      return { path: `${base}/settings` };
    case "ingredients":   return { path: `${base}/ingredients` };
    case "recipes":       return { path: `${base}/recipes` };
    // レシピIDが分かっていればその1件だけ。
    // 分からない場合（材料の単価変更など、影響が複数レシピに散る操作）は
    // /recipes 配下をまとめて再検証する。動的ルートのパターン指定にすると
    // 他プロジェクトのレシピ詳細まで巻き込むため、このプロジェクト配下に閉じる。
    case "recipeDetail":  return recipeId
      ? { path: `${base}/recipes/${recipeId}` }
      : { path: `${base}/recipes`, type: "layout" };
    case "shoppingList":  return { path: `${base}/shopping-list` };
    case "checklist":     return { path: `${base}/checklist` };
    case "schedule":      return { path: `${base}/schedule` };
    case "prototypes":    return { path: `${base}/prototypes` };
    case "results":       return { path: `${base}/results` };
    case "expenses":      return { path: `${base}/expenses` };
    case "simulation":    return { path: `${base}/simulation` };
  }
}

/**
 * 触ったデータの種類を渡すと、影響する画面をまとめて再検証する。
 * recipeId が分かる操作では渡すと、その1件だけをピンポイントに再検証する。
 */
export function revalidateProject(
  projectId: string,
  data: ProjectData,
  opts?: { recipeId?: string }
) {
  for (const screen of AFFECTED_SCREENS[data]) {
    const { path, type } = targetOf(screen, projectId, opts?.recipeId);
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  }
}
