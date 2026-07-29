import { db } from "@/db/db";
import { simulationScenarios, simulationItems } from "@/db/schema";
import { and, asc, count, eq, ne } from "drizzle-orm";
import type { SimulationScenario } from "@/db/schema";
import type { ScenarioLineInput } from "@/lib/breakeven";

// 1プロジェクトに置けるパターンの上限。
// 比較UI（並べて見る）が破綻せず、迷いすぎない数として5件にしている
export const SCENARIO_LIMIT = 5;

// 「これにする」の直前に自動で撮る控えの印。手動パターンと同じテーブルに置くが、
// 一覧・上限・比較表からは常に切り離して扱う（勝手に増えた1件が枠を食わないように）
export const BACKUP_SOURCE = "auto" as const;

export type ScenarioWithItems = SimulationScenario & {
  items: ScenarioLineInput[];
};

/**
 * プロジェクトのパターンを明細付きで取得する。
 * パターンと明細を1回ずつ引いてJSで束ね、パターン数ぶんの問い合わせ（N+1）を避ける。
 *
 * 手動・AIのパターン（patterns）と自動保存の控え（backup）は**混ぜずに返す**。
 * 同じ配列で返すと、上限判定や比較表の列に控えが紛れ込むため。
 */
export async function getScenarios(projectId: string): Promise<{
  patterns: ScenarioWithItems[];
  backup:   ScenarioWithItems | null;
}> {
  const scenarios = await db
    .select()
    .from(simulationScenarios)
    .where(eq(simulationScenarios.projectId, projectId))
    // createdAt は秒精度で同秒作成の順序が揺れるため id を第2キーに置く
    .orderBy(asc(simulationScenarios.createdAt), asc(simulationScenarios.id));

  if (scenarios.length === 0) return { patterns: [], backup: null };

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

  const withItems = scenarios.map((scenario) => ({
    ...scenario,
    items: byScenario.get(scenario.id) ?? [],
  }));

  return {
    patterns: withItems.filter((s) => s.source !== BACKUP_SOURCE),
    // 控えは1件だけ持つ運用だが、万一増えても最新の1件だけを見せる
    backup:   withItems.filter((s) => s.source === BACKUP_SOURCE).at(-1) ?? null,
  };
}

// 手動・AIパターンの登録数（上限チェック用の軽量クエリ）。
// 自動保存の控えは上限に数えない（勝手に増えた1件で枠が埋まるのを避ける）
export async function countScenarios(projectId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(simulationScenarios)
    .where(
      and(
        eq(simulationScenarios.projectId, projectId),
        ne(simulationScenarios.source, BACKUP_SOURCE)
      )
    );

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
