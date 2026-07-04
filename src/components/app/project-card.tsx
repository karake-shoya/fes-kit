import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getMyProjects } from "@/db/queries/projects";
import { ROLE_LABEL, PILL_CLASS, formatDate, daysUntil } from "@/lib/format";

export type ProjectRow = Awaited<ReturnType<typeof getMyProjects>>[number];

// イベント日の残り日数バッジ（当日・7日以内は強調）
function CountdownChip({ eventDate, today }: { eventDate: string; today: string }) {
  const days = daysUntil(eventDate, today);
  if (days < 0) {
    return (
      <span className="text-[10px] text-muted-foreground/70 bg-muted rounded-full px-2 py-0.5">
        終了
      </span>
    );
  }
  const label = days === 0 ? "今日！" : `あと${days}日`;
  const near  = days <= 7;
  return (
    <span
      className={`text-[10px] rounded-full px-2 py-0.5 border tabular-nums ${
        near
          ? "text-primary-foreground bg-primary border-primary font-semibold"
          : "text-primary bg-primary/10 border-primary/20"
      }`}
    >
      {label}
    </span>
  );
}

type Props = {
  project: ProjectRow;
  today: string;
  showOwner: boolean;
};

export function ProjectCard({ project: p, today, showOwner }: Props) {
  return (
    <Link href={`/projects/${p.id}`}>
      <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm active:scale-[0.98] transition-transform">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-foreground truncate">{p.name}</span>
            {p.eventDate && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> {formatDate(p.eventDate)}
              </span>
            )}
            {p.description && (
              <span className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</span>
            )}
            {showOwner && (p.ownerName ?? p.ownerEmail) && (
              <span className="text-xs text-muted-foreground/70 mt-1">
                作成者: {p.ownerName ?? p.ownerEmail}
              </span>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className={PILL_CLASS}>
              {ROLE_LABEL[p.myRole]}
            </span>
            {p.eventDate && <CountdownChip eventDate={p.eventDate} today={today} />}
          </div>
        </div>
      </div>
    </Link>
  );
}
