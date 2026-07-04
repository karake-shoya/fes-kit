import Link from "next/link";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getMyProjects } from "@/db/queries/projects";
import { CreateProjectDialog } from "@/components/app/create-project-dialog";
import { AppHeader } from "@/components/app/app-header";
import { ROLE_LABEL, PILL_CLASS, formatDate, todayYmd, daysUntil } from "@/lib/format";

type ProjectRow = Awaited<ReturnType<typeof getMyProjects>>[number];

// イベントが近いものを上に並べる。
// 未来のイベント（近い順）→ 日付未設定（作成順）→ 終了済み（新しい順）
function sortByEventDate(projects: ProjectRow[], today: string): ProjectRow[] {
  const upcoming = projects
    .filter((p) => p.eventDate && p.eventDate >= today)
    .sort((a, b) => a.eventDate!.localeCompare(b.eventDate!));
  const undated = projects.filter((p) => !p.eventDate);
  const past = projects
    .filter((p) => p.eventDate && p.eventDate < today)
    .sort((a, b) => b.eventDate!.localeCompare(a.eventDate!));
  return [...upcoming, ...undated, ...past];
}

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

export default async function DashboardPage() {
  const userId  = await requireAuth();
  const today   = todayYmd();
  const projects = sortByEventDate(await getMyProjects(userId), today);

  return (
    <>
      <AppHeader title="FesKit" />

      <main className="px-4 py-6 flex flex-col gap-6 max-w-lg mx-auto">
        <CreateProjectDialog />

        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <Image
              src="/mascot.png"
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 object-contain opacity-80"
            />
            <p className="text-muted-foreground text-sm leading-relaxed">
              まだプロジェクトがありません。<br />
              上のボタンから最初のプロジェクトを作りましょう！
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <li key={p.id}>
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
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
