"use server";

import { db } from "@/db/db";
import { recipes, simulationScenarios, simulationItems } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireProjectRole } from "@/lib/auth";
import { revalidateProject } from "@/lib/revalidate";
import { parsePositiveNumber, parseNonNegativeInt } from "@/lib/parse";
import { getRecipeNames, getRecipePlanRows } from "@/db/queries/recipes";
import {
  assertScenarioInProject,
  countScenarios,
  getScenarioItems,
  BACKUP_SOURCE,
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

/**
 * パターンを1件作る（手入力・AI提案で共通）。上限チェックもここでまとめる。
 *
 * 本体と明細は**同じ batch**（＝1トランザクション）で入れる。別々に投げると、
 * 明細だけ失敗したときに明細ゼロのパターンが残り、一覧に
 * 「全商品が入っていません・手残り −固定費」の幽霊カードが出てしまう。
 * id を自分で採番すれば `.returning()` を待たずに1回で入れられる。
 */
async function insertScenario(
  projectId: string,
  name: string,
  items: ScenarioLineInput[],
  source: "manual" | "ai"
) {
  if ((await countScenarios(projectId)) >= SCENARIO_LIMIT) {
    throw new Error(`パターンは${SCENARIO_LIMIT}件までです。使わないものを削除してください`);
  }

  const scenarioId = crypto.randomUUID();

  await db.batch([
    db.insert(simulationScenarios).values({ id: scenarioId, projectId, name, source }),
    db.insert(simulationItems).values(items.map((i) => ({ scenarioId, ...i }))),
  ]);

  revalidateProject(projectId, "scenarios");
}

export async function createScenario(projectId: string, formData: FormData) {
  await requireProjectRole(projectId);

  const name  = parseScenarioName(formData);
  const items = await parseScenarioItems(projectId, formData);

  await insertScenario(projectId, name, items, "manual");
}

/**
 * AI診断の提案をパターンとして保存する。
 *
 * 提案は `suggestSimulation()` が検算済みだが、**値はクライアントを一往復してくる**ので
 * ここでも商品の所属・数値をもう一度検証する（画面を信用して書き込まない）。
 */
export async function saveAiScenario(
  projectId: string,
  name: string,
  items: ScenarioLineInput[]
) {
  await requireProjectRole(projectId);

  const projectRecipeIds = new Set((await getRecipeNames(projectId)).map((r) => r.id));

  // 明細は (パターン, 商品) が主キー。同じ商品が2度来ると INSERT ごと失敗するので、
  // ここで最初の1件だけを残す（明細1件あたりの重複は画面の都合であって保存の都合ではない）
  const seen = new Set<string>();
  const validated = items.flatMap((item) => {
    if (!projectRecipeIds.has(item.recipeId)) throw new Error("商品が見つかりません");
    if (seen.has(item.recipeId)) return [];
    seen.add(item.recipeId);

    return [{
      recipeId:     item.recipeId,
      sellingPrice: parsePositiveNumber(String(item.sellingPrice), "販売価格"),
      quantity:     parseNonNegativeInt(item.quantity, "売る個数"),
    }];
  });

  if (validated.length === 0) throw new Error("商品を1つ以上登録してください");

  await insertScenario(projectId, name.trim() || "AIの提案", validated, "ai");
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
 * 上書きは取り消せないので、**書き換える直前の状態を控えとして自動保存する**。
 * 控えは1件だけ持ち、押すたびに上書きする（戻せるのは1手前まで）。
 * 控えを適用すると、そのとき控えに入るのは「戻す直前＝適用後の状態」になるので、
 * もう一度押せば戻る（行き来できる）。
 *
 * 売る個数が0の商品は「今回は作らない」の意味だが、作る予定数に0を書くと
 * レシピ編集（1以上必須）と食い違うため、価格だけ反映して予定数は据え置く。
 */
export async function applyScenario(scenarioId: string, projectId: string) {
  await requireProjectRole(projectId);
  await assertScenarioInProject(scenarioId, projectId);

  // 控えを撮る前に読み切る。控えの対象が自分自身（＝戻す操作）でも成立させるため
  const items = await getScenarioItems(scenarioId);
  if (items.length === 0) throw new Error("このパターンには商品がありません");

  // 控えは一部の商品ではなく「今のレシピ全部」を写す（戻したときに欠けが出ないように）
  const current = await getRecipePlanRows(projectId);

  const updatedAt  = new Date().toISOString();
  const backupId   = crypto.randomUUID();
  const backupName = "変更前（自動保存）";

  // 古い控えを明細ごと消す。FK の cascade 設定に頼らず自分で消す
  const clearBackup = [
    db.delete(simulationItems).where(
      inArray(
        simulationItems.scenarioId,
        db
          .select({ id: simulationScenarios.id })
          .from(simulationScenarios)
          .where(
            and(
              eq(simulationScenarios.projectId, projectId),
              eq(simulationScenarios.source, BACKUP_SOURCE)
            )
          )
      )
    ),
    db.delete(simulationScenarios).where(
      and(
        eq(simulationScenarios.projectId, projectId),
        eq(simulationScenarios.source, BACKUP_SOURCE)
      )
    ),
  ];

  // 写す商品が1件も無いなら控えは作らない（明細ゼロで INSERT すると drizzle が例外を投げる）。
  // 削除は cascade に頼らない方針なので、レシピが消えても明細が残ることは起こりうる
  const writeBackup = current.length === 0 ? [] : [
    db.insert(simulationScenarios).values({
      id: backupId, projectId, name: backupName, source: BACKUP_SOURCE,
    }),
    db.insert(simulationItems).values(
      current.map((r) => ({
        scenarioId:   backupId,
        recipeId:     r.id,
        sellingPrice: r.sellingPrice,
        quantity:     r.servings,
      }))
    ),
  ];

  const statements = [
    ...clearBackup,
    ...writeBackup,
    ...items.map((item) =>
      db
        .update(recipes)
        .set({
          sellingPrice: item.sellingPrice,
          // 0個は「作らない」の意味。予定数は触らず価格だけ反映する
          ...(item.quantity > 0 ? { servings: item.quantity } : {}),
          updatedAt,
        })
        .where(and(eq(recipes.id, item.recipeId), eq(recipes.projectId, projectId)))
    ),
  ];

  // 控えの保存と上書きを1トランザクションにする。
  // 別々だと「控えを撮り損ねたまま上書きされる」＝戻せない状態が起きうる
  await db.batch(statements as [(typeof statements)[number], ...typeof statements]);

  // recipes の波及先にシミュレーション画面も含まれるため、これ1本で足りる
  revalidateProject(projectId, "recipes");
}
