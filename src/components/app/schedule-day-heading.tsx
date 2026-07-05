import { PartyPopper } from "lucide-react";
import { EVENT_DAY_STYLE } from "@/lib/schedule";

// イベント当日バッジ（一覧タブの見出し・日別ボトムシートで共用）
export function EventDayBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <PartyPopper className="w-4 h-4" /> {EVENT_DAY_STYLE.label}
    </span>
  );
}
