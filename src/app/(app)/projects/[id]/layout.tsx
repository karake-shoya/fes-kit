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

  return (
    <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      {children}
      <ProjectTabBar projectId={id} />
    </div>
  );
}
