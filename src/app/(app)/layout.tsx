import { requireAuth } from "@/lib/auth";
import { PullToRefresh } from "@/components/app/pull-to-refresh";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  // 全画面共通のラッパー。高さ基準を min-h-dvh に統一し（iOSのアドレスバー
  // ずれ対策）、背景色もここで一括指定する。中身は「引っ張って更新」で包む。
  return (
    <div className="min-h-dvh bg-background">
      <PullToRefresh>{children}</PullToRefresh>
    </div>
  );
}
