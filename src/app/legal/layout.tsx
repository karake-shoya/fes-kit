import Image from "next/image";
import Link from "next/link";
import { LegalFooter } from "@/components/app/legal-footer";

// ログイン不要の法的ページ共通レイアウト。
// Clerk 認証を要求しないため AppHeader（UserButton前提）は使わず、
// 最小限のヘッダー（トップへの導線）だけを共通化する。
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <Image
            src="/mascot.png"
            alt="FesKit マスコット"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 object-contain"
          />
          <Link href="/" className="font-bold text-foreground">
            FesKit
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>

      <LegalFooter />
    </div>
  );
}
