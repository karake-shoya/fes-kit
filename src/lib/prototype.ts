export const RESULT_LABEL = {
  good:              { emoji: "✅", label: "成功",   color: "text-green-600" },
  needs_improvement: { emoji: "🔄", label: "要改善", color: "text-amber-600" },
  failed:            { emoji: "❌", label: "失敗",   color: "text-red-500"  },
} as const;

export const RESULT_OPTIONS = (
  Object.entries(RESULT_LABEL) as [keyof typeof RESULT_LABEL, (typeof RESULT_LABEL)[keyof typeof RESULT_LABEL]][]
).map(([value, { emoji, label }]) => ({ value, label: `${emoji} ${label}` }));
