"use server";

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { requireProjectRole } from "@/lib/auth";
import { getBreakevenInput } from "@/db/queries/simulation";
import { getProjectContext } from "@/db/queries/projects";
import {
  evaluateScenario,
  calcPurchaseRate,
  type ScenarioLineInput,
} from "@/lib/breakeven";
import { formatYen } from "@/lib/format";

// AI 採算診断の使用モデル（Claude API 直・安価/高速）。おすすめ販売価格と同じ。
const MODEL = anthropic("claude-haiku-4-5");

// 価格の最小値・刻み（0円やハンパな額を避ける）
const PRICE_FLOOR = 10;
const PRICE_STEP  = 10;

/**
 * AI に返させるもの。
 *
 * **損益分岐点・利益額のような計算結果は入れない**。
 * 数字をAIに作らせると出どころが2つになり信用できなくなるため、
 * AIには「いくらで何個」という判断だけを任せ、金額はすべてコードで計算する。
 */
const adviceSchema = z.object({
  items: z.array(
    z.object({
      recipeId:     z.string().describe("提示された商品IDをそのまま返す"),
      sellingPrice: z.number().describe("おすすめの販売価格（円・10円単位）"),
      quantity:     z.number().describe("その価格で売れると見込む個数（整数）"),
    })
  ).describe("商品ごとのおすすめ。提示された商品すべてについて返す"),
  reason: z.string().describe(
    "なぜこの値段と個数が良いかを、料理好きの店主に語りかけるやさしい日本語で1〜2文。専門用語は避ける。"
  ),
});

export type AdviceItem = ScenarioLineInput & {
  name:            string;
  currentPrice:    number;
  currentServings: number;
};

export type SimulationAdvice = {
  /** AIの言葉（検算結果より目立たせない前提で画面に出す） */
  reason:        string;
  /** 検算を通した提案。原価割れの商品は含まれない */
  items:         AdviceItem[];
  /** 検算で落とした商品と、その理由 */
  dropped:       { name: string; reason: string }[];
  /** コードで計算した提案の結果（AIには計算させない） */
  profit:        number;
  revenue:       number;
  fixedCost:     number;
  totalQuantity: number;
  purchaseRate:  number | null;
  /** 赤字・購入率100%超など、提案をそのまま採用する前に伝えるべきこと */
  warnings:      string[];
};

/**
 * プロジェクト全体を見て「いくらで何個売るか」を Claude に提案させる。
 *
 * 提案は**必ずこのサーバー側で検算**してから返す。
 * AIが赤字の案や、来場者全員が買う前提の案を出すことは普通にあり、
 * 黙って採用させると「AIが言ったから」で赤字の出店になるため。
 */
export async function suggestSimulation(projectId: string): Promise<SimulationAdvice> {
  await requireProjectRole(projectId);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI機能が未設定です（ANTHROPIC_API_KEY）");
  }

  const input = await getBreakevenInput(projectId);

  // 原価が分からない商品は値付けの相談ができない（原価割れの判定もできない）
  const targets = input.recipes.filter((r) => r.hasCost);
  if (targets.length === 0) {
    throw new Error("材料が登録されていないため相談できません");
  }

  const project = await getProjectContext(projectId);

  const projectLines = project
    ? [
        `出店・イベント名：${project.name}`,
        project.description ? `出店の説明・メモ：${project.description}` : null,
        project.eventDate   ? `イベント日：${project.eventDate}` : null,
      ].filter((v): v is string => v !== null)
    : [];

  const recipeLines = targets.map(
    (r) =>
      `- ID:${r.recipeId} / ${r.name} / 1個あたりの原価 ${formatYen(r.unitCost)} / ` +
      `今の販売価格 ${formatYen(r.sellingPrice)} / 今の作る予定数 ${r.servings}個`
  );

  const expenseLines = input.expenses.map((e) => `- ${e.label}：${formatYen(e.amount)}`);

  const prompt = [
    "あなたは学園祭・イベントの模擬店の採算づくりを手伝うアドバイザーです。",
    "この出店全体について、商品ごとの「販売価格」と「売れると見込む個数」を提案してください。",
    "",
    ...projectLines,
    "",
    "商品（1個あたりの原価は材料から計算済み）：",
    ...recipeLines,
    "",
    expenseLines.length > 0
      ? `売れた数に関係なくかかるお金（合計 ${formatYen(input.fixedCost)}）：`
      : "売れた数に関係なくかかるお金：まだ登録されていません",
    ...expenseLines,
    "",
    input.expectedVisitors
      ? `想定来場者数：${input.expectedVisitors}人（来場者が全員買う前提の個数は現実的ではありません）`
      : "想定来場者数：未入力",
    "",
    "守ってほしいこと：",
    "- 販売価格は10円単位のキリの良い数字にする",
    "- 販売価格は必ず原価より高くする",
    "- 個数は整数。来場者数に対して現実的な数にする",
    "- 提示したすべての商品について返す（作らない場合は個数0）",
    "- 損益分岐点や利益額は計算しないでください（こちらで計算します）",
  ].join("\n");

  const { object } = await generateObject({ model: MODEL, schema: adviceSchema, prompt });

  // ---- ここから検算。AIの出力をそのまま信じない ----

  const byRecipeId = new Map(targets.map((r) => [r.recipeId, r]));
  const round10 = (n: number) => Math.max(PRICE_FLOOR, Math.round(n / PRICE_STEP) * PRICE_STEP);

  const items: AdviceItem[] = [];
  const dropped: { name: string; reason: string }[] = [];

  for (const raw of object.items) {
    const recipe = byRecipeId.get(raw.recipeId);
    // 実在しない商品IDを返してきた分は捨てる（他プロジェクトの商品を混ぜないため）
    if (!recipe) continue;
    // 同じ商品を2度返してきた場合は最初の1件だけ採る
    if (items.some((i) => i.recipeId === recipe.recipeId)) continue;

    const sellingPrice = round10(raw.sellingPrice);
    const quantity     = Math.max(0, Math.floor(raw.quantity));

    // 原価割れはその商品だけ外す（売るほど損をする案を混ぜたまま合計を出さない）。
    // 判定はプロンプトで見せた表示額（円に丸めた原価）と突き合わせる。生の原価
    // （例 100.4円）で比べると、AIが提示どおり100円と答えたときに
    // 「¥100 が ¥100 を下回る」という読めない理由で外れてしまうため
    if (sellingPrice < Math.round(recipe.unitCost)) {
      dropped.push({
        name: recipe.name,
        reason: `おすすめ価格 ${formatYen(sellingPrice)} が原価 ${formatYen(recipe.unitCost)} を下回るため外しました`,
      });
      continue;
    }

    items.push({
      recipeId:        recipe.recipeId,
      name:            recipe.name,
      sellingPrice,
      quantity,
      currentPrice:    recipe.sellingPrice,
      currentServings: recipe.servings,
    });
  }

  if (items.length === 0) {
    throw new Error("提案を検算したところ、採用できる商品がありませんでした");
  }

  // 金額・個数はここで計算する（AIの数字は使わない）
  const result       = evaluateScenario(input.recipes, items, input.fixedCost);
  const purchaseRate = calcPurchaseRate(result.totalQuantity, input.expectedVisitors);

  const warnings: string[] = [];
  if (result.profit < 0) {
    warnings.push(
      `この提案どおりでも ${formatYen(-result.profit)} の赤字です。値段を上げるか、かかるお金を減らせないか見直しましょう。`
    );
  }
  if (purchaseRate !== null && purchaseRate > 1) {
    warnings.push(
      `来場者${input.expectedVisitors}人に対して${result.totalQuantity}個は、全員が1個以上買う前提です。`
    );
  }

  return {
    reason:        object.reason,
    items,
    dropped,
    profit:        result.profit,
    revenue:       result.revenue,
    fixedCost:     input.fixedCost,
    totalQuantity: result.totalQuantity,
    purchaseRate,
    warnings,
  };
}
