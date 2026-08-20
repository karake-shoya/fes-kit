"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { requireProjectRole } from "@/lib/auth";
import { getRecipeWithCost } from "@/db/queries/recipes";
import { getProjectContext } from "@/db/queries/projects";
import { formatYen } from "@/lib/format";
import { MODEL, assertAiConfigured, buildProjectLines, roundPrice } from "@/lib/ai-pricing";

// AI 提案の構造化出力スキーマ（Zod）。数字はすべて円・%。
const suggestionSchema = z.object({
  recommendedPrice: z.number().describe("おすすめの販売価格（円・10円単位のキリの良い数字）"),
  priceRangeMin: z.number().describe("妥当な価格帯の下限（円）"),
  priceRangeMax: z.number().describe("妥当な価格帯の上限（円）"),
  targetCostRate: z.number().describe("その価格での想定原価率（%・整数）"),
  reason: z.string().describe("なぜその価格が良いかを、料理好きの店主に語りかけるやさしい日本語で1〜2文。専門用語は避ける。"),
});

export type PriceSuggestion = z.infer<typeof suggestionSchema>;

// レシピの原価・材料構成をもとに、Claude におすすめ販売価格を提案させる。
// ANTHROPIC_API_KEY 未設定時は呼ばれない想定（UI側でボタンを隠す）だが、防御的にチェックする。
export async function suggestSellingPrice(
  recipeId: string,
  projectId: string
): Promise<PriceSuggestion> {
  await requireProjectRole(projectId);
  assertAiConfigured();

  const data = await getRecipeWithCost(recipeId, projectId);
  if (!data) throw new Error("レシピが見つかりません");

  const { recipe, cost } = data;
  if (cost.lines.length === 0 || cost.totalCost <= 0) {
    throw new Error("材料が登録されていないため提案できません");
  }

  // プロジェクト（出店）の背景情報。イベントの規模感・客層の推測に使ってもらう。
  const project = await getProjectContext(projectId);

  // 材料内訳を人間可読の箇条書きにしてプロンプトへ渡す
  const ingredientLines = cost.lines
    .map((l) => `- ${l.ingredientName}：${formatYen(l.lineCost)}（${l.quantityUsed}${l.unit}）`)
    .join("\n");

  // プロジェクト名・説明・イベント日があればコンテキスト行として差し込む
  const projectLines = buildProjectLines(project);

  const prompt = [
    "あなたはイベント・マルシェ・お祭りなどのフード出店の値付けを手伝うアドバイザーです。",
    "以下の商品について、来場者が買いやすく、かつ利益もしっかり残る販売価格を提案してください。",
    "飲食では原価率30%前後が目安ですが、その場で食べ歩く手頃感も考慮してください。",
    "出店・イベントの情報があれば、規模感や客層・雰囲気を推測して価格や理由に反映してください。",
    "",
    ...projectLines,
    `商品名：${recipe.name}`,
    `1個あたりの原価：${formatYen(cost.totalCost)}`,
    `現在の販売価格：${formatYen(recipe.sellingPrice)}（原価率 約${Math.round(cost.costRate)}%）`,
    "材料の内訳（1個分）：",
    ingredientLines,
    "",
    "おすすめ価格は10円単位のキリの良い数字にしてください。",
  ].join("\n");

  const { object } = await generateObject({
    model: MODEL,
    schema: suggestionSchema,
    prompt,
  });

  // 念のため円は整数・10円単位に丸め、原価率は整数へ整える（表示の安定化）
  return {
    recommendedPrice: roundPrice(object.recommendedPrice),
    priceRangeMin: roundPrice(object.priceRangeMin),
    priceRangeMax: roundPrice(object.priceRangeMax),
    targetCostRate: Math.round(object.targetCostRate),
    reason: object.reason,
  };
}
