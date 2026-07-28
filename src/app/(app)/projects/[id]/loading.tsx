import { PageSkeleton } from "@/components/app/page-skeleton";

// プロジェクト配下のページ遷移で出すスケルトン。
// ここに境界を置くことで、タブ切り替えのあいだも projects/[id]/layout.tsx の
// 下部タブバーは表示されたまま、中身だけがスケルトンに差し替わる
// （(app)/loading.tsx だけだと、タブバーごと画面全体が消えてしまう）。
export default function Loading() {
  return <PageSkeleton />;
}
