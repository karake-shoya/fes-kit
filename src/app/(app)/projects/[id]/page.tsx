import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Settings,
  CalendarDays,
  ChevronRight,
  ShoppingCart,
  ClipboardList,
  CookingPot,
  PartyPopper,
  TriangleAlert,
  ListTodo,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getProject } from "@/db/queries/projects";
import { assertProjectAccess } from "@/db/queries/auth";
import { getProjectStats, getUpcomingSchedules } from "@/db/queries/stats";
import { getRecipes } from "@/db/queries/recipes";
import { AppHeader } from "@/components/app/app-header";
import { MemberAvatar, AVATAR_FALLBACK_CLASS } from "@/components/app/member-avatar";
import { formatDate, todayYmd, daysUntil } from "@/lib/format";
import { formatDateRange, STATUS_STYLE } from "@/lib/schedule";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId  = await requireAuth();
  const today   = todayYmd();

  const [project, stats, upcoming, recipeList] = await Promise.all([
    getProject(id),
    getProjectStats(id),
    getUpcomingSchedules(id, today),
    getRecipes(id),
    assertProjectAccess(id, userId).catch(() => notFound()),
  ]);

  if (!project) notFound();

  // 赤字レシピ数（材料登録済みで利益率がマイナスのもの）
  const lossCount = recipeList.filter(
    (r) => r.ingredientCount > 0 && r.cost.profitRate < 0
  ).length;

  const navItems = [
    { href: "ingredients", label: "材料マスタ",   Icon: ShoppingCart,  desc: "食材の単価・購入量を管理", badge: `${stats.ingredients}件` },
    { href: "recipes",     label: "レシピ",       Icon: ClipboardList, desc: "商品と原価・利益率を計算", badge: `${recipeList.length}品` },
    { href: "schedule",    label: "スケジュール", Icon: CalendarDays,  desc: "準備〜当日の作業を管理",   badge: stats.tasksTotal > 0 ? `${stats.tasksDone}/${stats.tasksTotal}` : "0件" },
    { href: "prototypes",  label: "試作記録",     Icon: CookingPot,    desc: "試作の感想・写真を残す",   badge: `${stats.prototypes}回` },
  ] as const;

  return (
    <>
      <AppHeader
        title={project.name}
        backHref="/dashboard"
        action={
          <Link
            href={`/projects/${id}/settings`}
            aria-label="プロジェクト設定"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="w-5 h-5" />
          </Link>
        }
      />

      <main className="px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
        {/* メンバー（タップで設定ページへ） */}
        <Link
          href={`/projects/${id}/settings`}
          className="flex items-center gap-2 active:opacity-70 transition-opacity"
        >
          <div className="flex -space-x-2">
            {project.members.slice(0, 4).map((m) => (
              <MemberAvatar
                key={m.userId}
                name={m.name}
                email={m.email}
                avatarUrl={m.avatarUrl}
                className="ring-2 ring-background"
              />
            ))}
            {project.members.length > 4 && (
              <div className={`${AVATAR_FALLBACK_CLASS} ring-2 ring-background`}>
                +{project.members.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">メンバー {project.members.length}人</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
        </Link>

        {/* イベントまでのカウントダウン + 準備の進みぐあい */}
        <CountdownHero
          eventDate={project.eventDate}
          today={today}
          projectId={id}
          tasksDone={stats.tasksDone}
          tasksTotal={stats.tasksTotal}
        />

        {/* 赤字レシピの注意喚起 */}
        {lossCount > 0 && (
          <Link href={`/projects/${id}/recipes`}>
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 active:scale-[0.98] transition-transform">
              <TriangleAlert className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 leading-snug">
                赤字の商品が{lossCount}品あります。販売価格か材料を見直しましょう
              </p>
              <ChevronRight className="ml-auto w-4 h-4 text-red-400 shrink-0" />
            </div>
          </Link>
        )}

        {/* 次にやること（未完了の直近タスク） */}
        {upcoming.length > 0 && (
          <section className="bg-card rounded-2xl border border-border px-4 py-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
              <ListTodo className="w-4 h-4 text-primary" /> 次にやること
            </h2>
            <ul className="flex flex-col gap-2">
              {upcoming.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/projects/${id}/schedule`}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5 active:scale-[0.98] transition-transform"
                  >
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums w-14">
                      {formatDateRange(s.startDate, s.endDate)}
                    </span>
                    <span className="text-sm text-foreground truncate">{s.title}</span>
                    <span
                      className={`ml-auto shrink-0 text-xs rounded-full px-2 py-0.5 border ${STATUS_STYLE[s.status].text}`}
                    >
                      {STATUS_STYLE[s.status].label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {project.description && (
          <p className="text-sm text-muted-foreground bg-card rounded-2xl border border-border px-4 py-3">
            {project.description}
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={`/projects/${id}/${item.href}`}>
                <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <item.Icon className="w-5.5 h-5.5 text-primary" />
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.desc}</span>
                  </div>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    <span className="text-xs text-muted-foreground tabular-nums">{item.badge}</span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

// イベント日カウントダウンと準備進捗のヒーローカード
function CountdownHero({
  eventDate,
  today,
  projectId,
  tasksDone,
  tasksTotal,
}: {
  eventDate: string | null;
  today: string;
  projectId: string;
  tasksDone: number;
  tasksTotal: number;
}) {
  const days = eventDate ? daysUntil(eventDate, today) : null;
  const progress = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  return (
    <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-5 flex flex-col gap-4 shadow-sm">
      {days === null ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">イベント日が未設定です</p>
          <Link
            href={`/projects/${projectId}/settings`}
            className="text-sm text-primary underline underline-offset-4"
          >
            設定からイベント日を決めましょう
          </Link>
        </div>
      ) : days > 0 ? (
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> {formatDate(eventDate!)}
            </p>
            <p className="text-sm text-foreground">イベントまで</p>
          </div>
          <p className="text-foreground leading-none">
            <span className="text-sm">あと</span>
            <span className="mx-1 text-4xl font-bold tabular-nums text-primary">{days}</span>
            <span className="text-sm">日</span>
          </p>
        </div>
      ) : days === 0 ? (
        <div className="flex items-center gap-2">
          <PartyPopper className="w-6 h-6 text-primary shrink-0" />
          <p className="text-lg font-bold text-foreground">今日が本番です！がんばりましょう</p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">イベントは終了しました</p>
          <p className="text-xs text-muted-foreground">
            おつかれさまでした（{formatDate(eventDate!)}）
          </p>
        </div>
      )}

      {/* 準備の進みぐあい（タスクがあるときだけ） */}
      {tasksTotal > 0 && (days === null || days >= 0) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>準備の進みぐあい</span>
            <span className="tabular-nums">
              {tasksDone}/{tasksTotal} 完了
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="準備の進みぐあい"
            className="h-2 rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
