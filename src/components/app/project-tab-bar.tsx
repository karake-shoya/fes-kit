"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  ShoppingCart,
  ClipboardList,
  CalendarDays,
  CookingPot,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  /** プロジェクトルートからの相対パス（ホームは空文字） */
  href: string;
  label: string;
  Icon: LucideIcon;
};

const TABS: Tab[] = [
  { href: "",             label: "ホーム",  Icon: House },
  { href: "/ingredients", label: "材料",    Icon: ShoppingCart },
  { href: "/recipes",     label: "レシピ",  Icon: ClipboardList },
  { href: "/schedule",    label: "予定",    Icon: CalendarDays },
  { href: "/prototypes",  label: "試作",    Icon: CookingPot },
];

/**
 * プロジェクト配下の全画面に共通で出す下部タブバー。
 * スマホの親指で届く位置に主要画面への導線をまとめる。
 * PWAスタンドアロン時のホームバーと重ならないよう safe-area を確保する。
 */
export function ProjectTabBar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav
      aria-label="プロジェクト内ナビゲーション"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((tab) => {
          const target = `${base}${tab.href}`;
          // ホームタブは設定画面でも点灯させる（設定はホームから開くため）
          const active = tab.href === ""
            ? pathname === base || pathname === `${base}/settings`
            : pathname.startsWith(target);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={target}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
