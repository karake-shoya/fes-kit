import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

type Props = {
  /** ヘッダーに表示するタイトル */
  title: string;
  /** 戻る先のパス。未指定なら戻る矢印を表示しない（トップ画面用） */
  backHref?: string;
  /** タイトル下に小さく添える補足（イベント日など） */
  subtitle?: React.ReactNode;
  /** 右端の UserButton の手前に置く操作（追加ボタン・設定アイコン等） */
  action?: React.ReactNode;
};

/**
 * アプリ共通ヘッダー。
 * スクロールしても上部に固定し、戻る／タイトル／操作／アカウントを1段にまとめる。
 * UserButton を全画面の右端に常設することで、どの画面からでもアカウント操作ができる。
 */
export function AppHeader({ title, backHref, subtitle, action }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="戻る"
            className="-ml-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-bold text-foreground">{title}</h1>
          {subtitle && (
            <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {action}
          <UserButton />
        </div>
      </div>
    </header>
  );
}
