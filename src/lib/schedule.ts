import { parseISO, eachDayOfInterval, format, isValid } from "date-fns";
import { ja } from "date-fns/locale";
import type { Schedule } from "@/db/schema";

// ステータス色定義（CLAUDE.md準拠）
export const STATUS_STYLE = {
  todo:        { bar: "bg-gray-300",   label: "未着手", text: "text-gray-500"  },
  in_progress: { bar: "bg-blue-400",   label: "進行中", text: "text-blue-600"  },
  done:        { bar: "bg-green-500",  label: "完了",   text: "text-green-600" },
} as const;

// イベント当日は別途ハイライト
export const EVENT_DAY_STYLE = {
  bar: "bg-orange-400", label: "当日！", text: "text-orange-600",
} as const;

export type ScheduleStatus = keyof typeof STATUS_STYLE;

// ステータスのサイクル順（ワンタップ切り替え用）
export const STATUS_ORDER: ScheduleStatus[] = ["todo", "in_progress", "done"];

export function nextStatus(current: ScheduleStatus): ScheduleStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

// "YYYY-MM-DD" が正しい日付形式か検証する
export function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isValid(parseISO(value));
}

// 期間を "YYYY-MM-DD" の配列に展開する（カレンダーのドット表示用）
export function eachDateInRange(start: string, end: string): string[] {
  const s = parseISO(start);
  const e = parseISO(end);
  if (!isValid(s) || !isValid(e) || e < s) return [start];
  return eachDayOfInterval({ start: s, end: e }).map((d) => format(d, "yyyy-MM-dd"));
}

// 日付範囲の表示（1日なら "7/9" / 期間なら "7/9〜7/13"）
export function formatDateRange(start: string, end: string): string {
  const s = parseISO(start);
  if (start === end) return format(s, "M/d");
  const e = parseISO(end);
  return `${format(s, "M/d")}〜${format(e, "M/d")}`;
}

// グループ見出し用（"7月9日(火)"）
export function formatDayHeading(ymd: string): string {
  return format(parseISO(ymd), "M月d日(E)", { locale: ja });
}

// "YYYY-MM-DD" を Date（ローカル0時）に変換する
export function ymdToDate(ymd: string): Date {
  return parseISO(ymd);
}

// Date を "YYYY-MM-DD"（ローカル基準）に変換する
export function dateToYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// 開始日でグループ化する（list は startDate 昇順前提）。
// 各グループ内はステータス順（未着手→進行中→完了）に並べ、
// 同ステータス内は元の安定順（id 昇順）を保つ。
export function groupSchedulesByDay(list: Schedule[]): [string, Schedule[]][] {
  const groups = new Map<string, Schedule[]>();
  for (const s of list) {
    const g = groups.get(s.startDate) ?? [];
    g.push(s);
    groups.set(s.startDate, g);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  }
  return Array.from(groups.entries());
}

// ステータスでグループ化する（STATUS_ORDER の順で返す）。
// list は startDate 昇順前提のため、各グループ内は自然に日付順になる。
// 該当タスクが0件のステータスは返さない。
export function groupSchedulesByStatus(list: Schedule[]): [ScheduleStatus, Schedule[]][] {
  return STATUS_ORDER.map(
    (status) => [status, list.filter((s) => s.status === status)] as [ScheduleStatus, Schedule[]]
  ).filter(([, items]) => items.length > 0);
}
