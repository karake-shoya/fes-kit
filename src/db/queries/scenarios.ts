import { db } from "@/db/db";
import { simulationScenarios, simulationItems } from "@/db/schema";
import { and, asc, count, eq } from "drizzle-orm";
import type { SimulationScenario } from "@/db/schema";
import type { ScenarioLineInput } from "@/lib/breakeven";

// 1プロジェクトに置けるパターンの上限。
// 比較UI（並べて見る）が破綻せず、迷いすぎない数として5件にしている
export const SCENARIO_LIMIT = 5;

export type ScenarioWithItems = SimulationScenario & {
  items: ScenarioLineInput[];
};

/**
 * プロジェクトのパターンを明細付きで取得する。
 * パターンと明細を1回ずつ引いてJSで束ね、パターン数ぶんの問い合わせ（N+1）を避ける。
 */
export async function getScenarios(projectId: string): Promise<ScenarioWithItems[]> {
  const scenarios = await db
    .select()
    .from(simulationScenarios)
    .where(eq(simulationScenarios.projectId, projectId))
    // createdAt は秒精度で同秒作成の順序が揺れるため id を第2キーに置く
    .orderBy(asc(simulationScenarios.createdAt), asc(simulationScenarios.id));

  if (scenarios.length === 0) return [];

  const rows = await db
    .select({
      scenarioId:   simulationItems.scenarioId,
      recipeId:     simulationItems.recipeId,
      sellingPrice: simulationItems.sellingPrice,
      quantity:     simulationItems.quantity,
    })
    .from(simulationItems)
    .innerJoin(
      simulationScenarios,
      eq(simulationScenarios.id, simulationItems.scenarioId)
    )
    .where(eq(simulationScenarios.projectId, projectId));

  const byScenario = new Map<string, ScenarioLineInput[]>();
  for (const { scenarioId, ...item } of rows) {
    const list = byScenario.get(scenarioId) ?? [];
    list.push(item);
    byScenario.set(scenarioId, list);
  }

  return scenarios.map((scenario) => ({
    ...scenario,
    items: byScenario.get(scenario.id) ?? [],
  }));
}

// パターンの登録数（上限チェック用の軽量クエリ）
export async function countScenarios(projectId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(simulationScenarios)
    .where(eq(simulationScenarios.projectId, projectId));

  return row?.value ?? 0;
}

// scenarioId が当該プロジェクトのパターンか照合する（越境防止）
// actions/scenario.ts で共用
export async function assertScenarioInProject(scenarioId: string, projectId: string) {
  const [scenario] = await db
    .select({ id: simulationScenarios.id })
    .from(simulationScenarios)
    .where(
      and(
        eq(simulationScenarios.id, scenarioId),
        eq(simulationScenarios.projectId, projectId)
      )
    )
    .limit(1);

  if (!scenario) throw new Error("パターンが見つかりません");
}

// パターンの明細を取得する（「これにする」でレシピへ書き戻すときに使う）
export async function getScenarioItems(scenarioId: string): Promise<ScenarioLineInput[]> {
  return db
    .select({
      recipeId:     simulationItems.recipeId,
      sellingPrice: simulationItems.sellingPrice,
      quantity:     simulationItems.quantity,
    })
    .from(simulationItems)
    .where(eq(simulationItems.scenarioId, scenarioId));
}
