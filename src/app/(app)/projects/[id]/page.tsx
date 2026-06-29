import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Settings,
  CalendarDays,
  ChevronRight,
  ShoppingCart,
  ClipboardList,
  CookingPot,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getProject } from "@/db/queries/projects";
import { assertProjectAccess } from "@/db/queries/auth";
import { AppHeader } from "@/components/app/app-header";
import { formatDate } from "@/lib/format";

const NAV_ITEMS = [
  { href: "ingredients", label: "材料マスタ",   Icon: ShoppingCart,  desc: "食材の単価・購入量を管理" },
  { href: "recipes",     label: "レシピ",       Icon: ClipboardList, desc: "商品と原価・利益率を計算" },
  { href: "schedule",    label: "スケジュール", Icon: CalendarDays,  desc: "準備〜当日の作業を管理" },
  { href: "prototypes",  label: "試作記録",     Icon: CookingPot,    desc: "試作の感想・写真を残す" },
] as const;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId  = await requireAuth();

  const [project] = await Promise.all([
    getProject(id),
    assertProjectAccess(id, userId).catch(() => notFound()),
  ]);

  if (!project) notFound();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={project.name}
        backHref="/dashboard"
        subtitle={
          project.eventDate ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> {formatDate(project.eventDate)}
            </span>
          ) : undefined
        }
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
        {project.description && (
          <p className="text-sm text-muted-foreground bg-card rounded-2xl border border-border px-4 py-3">
            {project.description}
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={`/projects/${id}/${item.href}`}>
                <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                  <item.Icon className="w-7 h-7 text-muted-foreground shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.desc}</span>
                  </div>
                  <ChevronRight className="ml-auto w-5 h-5 text-muted-foreground/40" />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="text-xs text-muted-foreground/70 text-center mt-2">
          メンバー {project.members.length}人
        </div>
      </main>
    </div>
  );
}
