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
  | "salesRecords";// 当日の売上・実績

// プロジェクト配下の画面
type Screen =
  | "home" | "settings" | "ingredients" | "recipes" | "recipeDetail"
  | "shoppingList" | "checklist" | "schedule" | "prototypes" | "results";

// データ → 影響を受ける画面
const AFFECTED_SCREENS: Record<ProjectData, Screen[]> = {
  project:     ["home", "settings"],
  // 材料の単価・購入数量はレシピの原価、買い出しの必要量、実績の利益にそのまま効く
  ingredients: ["ingredients", "recipes", "recipeDetail", "shoppingList", "results", "home"],
  // レシピの販売価格・作る予定数・材料構成も同じ範囲に波及する（ホームは赤字商品の警告とバッジ）
  recipes:     ["recipes", "recipeDetail", "shoppingList", "results", "home"],
  // ホームの「準備の進みぐあい」「次にやること」はスケジュールの完了数を見ている
  schedules:   ["schedule", "home"],
  // ホームの進捗バーは持ち物のチェック数も合算している
  checklist:   ["checklist", "home"],
  prototypes:  ["prototypes"],
  // 実績ページ自身は意図的に再検証しない。カードがローカルstateで最新値を表示しており、
  // 保存のたびに再レンダーが返ると連打編集中の値が古いサーバー値へ巻き戻るため
  // （再訪時は動的レンダーで整合する）。ホームのバッジだけ更新する。
  salesRecords: ["home"],
};

function pathOf(screen: Screen, projectId: string, recipeId?: string): string {
  const base = `/projects/${projectId}`;
  switch (screen) {
    case "home":          return base;
    case "settings":      return `${base}/settings`;
    case "ingredients":   return `${base}/ingredients`;
    case "recipes":       return `${base}/recipes`;
    // レシピIDが分かっていればその1件、分からなければ動的ルートごと再検証する
    // （材料の単価変更は、その材料を使う全レシピの詳細に効くため）
    case "recipeDetail":  return recipeId
      ? `${base}/recipes/${recipeId}`
      : "/projects/[id]/recipes/[recipeId]";
    case "shoppingList":  return `${base}/shopping-list`;
    case "checklist":     return `${base}/checklist`;
    case "schedule":      return `${base}/schedule`;
    case "prototypes":    return `${base}/prototypes`;
    case "results":       return `${base}/results`;
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
    const path = pathOf(screen, projectId, opts?.recipeId);
    // 動的ルートのパターン指定はページ単位の再検証として渡す
    if (path.includes("[")) revalidatePath(path, "page");
    else revalidatePath(path);
  }
}
