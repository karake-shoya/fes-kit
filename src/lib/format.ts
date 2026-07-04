// 円表示（小数は四捨五入して整数円に）
// 負の値は「-¥150」のように符号を先頭に出す（¥-150 はペルソナに不自然なため）
export function formatYen(value: number): string {
  const rounded = Math.round(value);
  const sign    = rounded < 0 ? "-" : "";
  return `${sign}¥${Math.abs(rounded).toLocaleString()}`;
}

// 日付表示（YYYY-MM-DD → YYYY/MM/DD）。空・未設定は空文字を返す。
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/-/g, "/");
}

// 今日の日付を日本時間の "YYYY-MM-DD" で返す
// （Vercel のサーバーは UTC で動くためタイムゾーンを明示する。sv-SE ロケールはISO形式）
export function todayYmd(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

// ymd（YYYY-MM-DD）が today から何日後かを返す（当日=0、過去は負の値）
export function daysUntil(ymd: string, today: string): number {
  return Math.round((Date.parse(ymd) - Date.parse(today)) / 86_400_000);
}

// プロジェクトのロールラベル（owner / editor / viewer → 日本語）
export const ROLE_LABEL = {
  owner:  "オーナー",
  editor: "編集者",
  viewer: "閲覧者",
} as const;

// ロール／情報を示す小さなピル（角丸バッジ）の共通スタイル。
// ダッシュボード・設定・招待ページで見た目を揃えるために1箇所に集約する
export const PILL_CLASS =
  "text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5";

// 利益率の表示スタイル（黒字＝緑 / 赤字＝赤 / 原価ゼロ＝グレー）
// ペルソナ（数字が苦手）が一目で判断できるようアイコン・短いラベルを添える
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

export function profitStyle(
  profitRate: number,
  hasCost: boolean
): { text: string; Icon: LucideIcon | null; label: string } {
  if (!hasCost) {
    return { text: "text-muted-foreground/70", Icon: null, label: "材料未登録" };
  }
  if (profitRate >= 0) {
    return { text: "text-green-600", Icon: TrendingUp, label: "黒字" };
  }
  return { text: "text-red-600", Icon: TrendingDown, label: "赤字（見直そう）" };
}
