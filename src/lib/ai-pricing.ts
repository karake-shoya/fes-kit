import { anthropic } from "@ai-sdk/anthropic";

// AI機能（おすすめ販売価格・AI採算診断）で共通の使用モデル（Claude API 直・安価/高速）
// ANTHROPIC_API_KEY を環境変数から自動で読み取る。
export const MODEL = anthropic("claude-haiku-4-5");

// 価格の最小値・刻み（0円やハンパな額を避ける）
export const PRICE_FLOOR = 10;
export const PRICE_STEP = 10;

// AIが返した価格をPRICE_STEP単位に丸め、PRICE_FLOORを下回らないようにする
export function roundPrice(n: number): number {
  return Math.max(PRICE_FLOOR, Math.round(n / PRICE_STEP) * PRICE_STEP);
}

// ANTHROPIC_API_KEY未設定時はAI機能を使わせない
// UI側でボタンを隠す想定だが、防御的にサーバー側でもチェックする。
export function assertAiConfigured(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI機能が未設定です（ANTHROPIC_API_KEY）");
  }
}

type ProjectContext = {
  name: string;
  description: string | null;
  eventDate: string | null;
} | null;

// プロジェクト（出店）名・説明・イベント日があればプロンプト用のコンテキスト行として組み立てる
export function buildProjectLines(project: ProjectContext): string[] {
  if (!project) return [];

  return [
    `出店・イベント名：${project.name}`,
    project.description ? `出店の説明・メモ：${project.description}` : null,
    project.eventDate ? `イベント日：${project.eventDate}` : null,
  ].filter((v): v is string => v !== null);
}
