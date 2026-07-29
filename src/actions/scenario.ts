"use server";

import { db } from "@/db/db";
import { recipes, simulationScenarios, simulationItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireProjectRole } from "@/lib/auth";
import { revalidateProject } from "@/lib/revalidate";
import { parsePositiveNumber, parseNonNegativeInt } from "@/lib/parse";
import { getRecipeNames } from "@/db/queries/recipes";
import {
  assertScenarioInProject,
  countScenarios,
  getScenarioItems,
  SCENARIO_LIMIT,
} from "@/db/queries/scenarios";
import type { ScenarioLineInput } from "@/lib/breakeven";

// 明細はフォーム上で商品ごとに price-<recipeId> / qty-<recipeId> という名前を持つ。
// 商品数が可変なので、固定のフィールド名ではなく接頭辞で拾う
const PRICE_PREFIX = "price-";
const QTY_PREFIX   = "qty-";

// パターン名の入力値
function parseScenarioName(formData: FormData): string {
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) throw new Error("パターン名は必須です");
  return name;
}

/**
 * フォームから明細を組み立てる。
 * recipeId は必ずこのプロジェクトの商品か照合する（他プロジェクトの商品を
 * 混ぜたパターンを作られると、そのまま「これにする」で書き戻せてしまうため）。
 */
async function parseScenarioItems(
  projectId: string,
  formData: FormData
): Promise<ScenarioLineInput[]> {
  const projectRecipeIds = new Set(
    (await getRecipeNames(projectId)).map((r) => r.id)
  );

  const items: ScenarioLineInput[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(PRICE_PREFIX)) continue;

    const recipeId = key.slice(PRICE_PREFIX.length);
    if (!projectRecipeIds.has(recipeId)) throw new Error("商品が見つかりません");

    items.push({
      recipeId,
      sellingPrice: parsePositiveNumber(String(value), "販売価格"),
      quantity: parseNonNegativeInt(
        String(formData.get(`${QTY_PREFIX}${recipeId}`) ?? ""),
        "売る個数"
      ),
    });
  }

  if (items.length === 0) throw new Error("商品を1つ以上登録してください");

  return items;
}

// 明細をまとめて入れ替える（部分更新ではなく総入れ替え。
// フォームは常に全商品を送るので、差分を追うより単純で取りこぼしがない）。
// 消してから入れるので、別々に投げると途中で失敗したときに明細が全消えしたまま残る。
// batch で1トランザクションにまとめ、失敗したら元の明細ごと巻き戻す
async function replaceItems(scenarioId: string, items: ScenarioLineInput[]) {
  await db.batch([
    db.delete(simulationItems).where(eq(simulationItems.scenarioId, scenarioId)),
    db.insert(simulationItems).values(items.map((i) => ({ scenarioId, ...i }))),
  ]);
}

export async function createScenario(projectId: string, formData: FormData) {
  await requireProjectRole(projectId);

  const name  = parseScenarioName(formData);
  const items = await parseScenarioItems(projectId, formData);

  if ((await countScenarios(projectId)) >= SCENARIO_LIMIT) {
    throw new Error(`パターンは${SCENARIO_LIMIT}件までです。使わないものを削除してください`);
  }

  const [scenario] = await db
    .insert(simulationScenarios)
    .values({ projectId, name })
    .returning({ id: simulationScenarios.id });

  await replaceItems(scenario.id, items);

  revalidateProject(projectId, "scenarios");
}

export async function updateScenario(
  scenarioId: string,
  projectId: string,
  formData: FormData
) {
  await requireProjectRole(projectId);
  await assertScenarioInProject(scenarioId, projectId);

  const name  = parseScenarioName(formData);
  const items = await parseScenarioItems(projectId, formData);

  await db
    .update(simulationScenarios)
    .set({ name, updatedAt: new Date().toISOString() })
    .where(eq(simulationScenarios.id, scenarioId));

  await replaceItems(scenarioId, items);

  revalidateProject(projectId, "scenarios");
}

export async function deleteScenario(scenarioId: string, projectId: string) {
  await requireProjectRole(projectId);

  await db
    .delete(simulationScenarios)
    .where(
      and(
        eq(simulationScenarios.id, scenarioId),
        eq(simulationScenarios.projectId, projectId)
      )
    );

  revalidateProject(projectId, "scenarios");
}

/**
 * パターンを本採用する（「これにする」）。
 *
 * ここが唯一 recipes を書き換える場所。逆に言えば、それまでは何度試しても
 * 実データは汚れない（非破壊で試せることがこの機能の前提）。
 *
 * 売る個数が0の商品は「今回は作らない」の意味だが、作る予定数に0を書くと
 * レシピ編集（1以上必須）と食い違うため、価格だけ反映して予定数は据え置く。
 */
export async function applyScenario(scenarioId: string, projectId: string) {
  await requireProjectRole(projectId);
  await assertScenarioInProject(scenarioId, projectId);

  const items = await getScenarioItems(scenarioId);
  if (items.length === 0) throw new Error("このパターンには商品がありません");

  const updatedAt = new Date().toISOString();
  const statements = items.map((item) =>
    db
      .update(recipes)
      .set({
        sellingPrice: item.sellingPrice,
        // 0個は「作らない」の意味。予定数は触らず価格だけ反映する
        ...(item.quantity > 0 ? { servings: item.quantity } : {}),
        updatedAt,
      })
      .where(and(eq(recipes.id, item.recipeId), eq(recipes.projectId, projectId)))
  );

  // 1件でも失敗したら全部やめる（価格だけ変わって個数が古いまま、を避ける）
  await db.batch(statements as [(typeof statements)[number], ...typeof statements]);

  // recipes の波及先にシミュレーション画面も含まれるため、これ1本で足りる
  revalidateProject(projectId, "recipes");
}
