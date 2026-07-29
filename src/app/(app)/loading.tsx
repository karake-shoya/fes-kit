import { PageSkeleton } from "@/components/app/page-skeleton";

// アプリ全体（ダッシュボード／プロジェクト配下）へ入るときのスケルトン。
// より内側の loading.tsx がある画面ではそちらが優先され、
// ここは初回入場やレイアウト自体の読み込み時だけ出る。
export default function Loading() {
  return (
    <div className="min-h-dvh bg-background">
      <PageSkeleton />
    </div>
  );
}
