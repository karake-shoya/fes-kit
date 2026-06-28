import { CircleCheck, RefreshCw, CircleX, type LucideIcon } from "lucide-react";

export const RESULT_LABEL: Record<
  "good" | "needs_improvement" | "failed",
  { Icon: LucideIcon; label: string; color: string }
> = {
  good:              { Icon: CircleCheck, label: "成功",   color: "text-green-600" },
  needs_improvement: { Icon: RefreshCw,   label: "要改善", color: "text-amber-600" },
  failed:            { Icon: CircleX,     label: "失敗",   color: "text-red-500"  },
} as const;

// ネイティブ <select> の option ではアイコンを描画できないため、テキストのみ
export const RESULT_OPTIONS = (
  Object.entries(RESULT_LABEL) as [keyof typeof RESULT_LABEL, (typeof RESULT_LABEL)[keyof typeof RESULT_LABEL]][]
).map(([value, { label }]) => ({ value, label }));
