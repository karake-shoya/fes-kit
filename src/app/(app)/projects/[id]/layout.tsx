import { ProjectTabBar } from "@/components/app/project-tab-bar";

// プロジェクト配下の共通レイアウト。
// 下部タブバーを常設し、コンテンツがタブバーに隠れないよう余白を確保する
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 高さ・背景は (app)/layout.tsx が担保するため、ここではタブバー分の
  // 下余白のみを確保する（min-h と余白の二重加算による無駄スクロールを防ぐ）
  return (
    <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom)+0.375rem)]">
      {children}
      <ProjectTabBar projectId={id} />
    </div>
  );
}
