import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
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
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex flex-col min-w-0">
          <h1 className="font-bold text-zinc-800 truncate">{project.name}</h1>
          {project.eventDate && (
            <span className="text-xs text-zinc-500 inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> {project.eventDate.replace(/-/g, "/")}
            </span>
          )}
        </div>
        <Link href={`/projects/${id}/settings`} className="ml-auto text-zinc-400 hover:text-zinc-600">
          <Settings className="w-5 h-5" />
        </Link>
      </header>

      <main className="px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
        {project.description && (
          <p className="text-sm text-zinc-600 bg-white rounded-2xl border border-zinc-200 px-4 py-3">
            {project.description}
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={`/projects/${id}/${item.href}`}>
                <div className="bg-white rounded-2xl border border-zinc-200 px-4 py-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                  <item.Icon className="w-7 h-7 text-zinc-600 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-zinc-800">{item.label}</span>
                    <span className="text-xs text-zinc-500">{item.desc}</span>
                  </div>
                  <ChevronRight className="ml-auto w-5 h-5 text-zinc-300" />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="text-xs text-zinc-400 text-center mt-2">
          メンバー {project.members.length}人
        </div>
      </main>
    </div>
  );
}
