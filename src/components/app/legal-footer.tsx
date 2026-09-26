import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/legal/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
];

// 法的ページへの導線。ログイン前後を問わず、どの画面からも辿れるように
// ダッシュボード・プロジェクト配下・サインイン/サインアップ画面に共通で置く。
export function LegalFooter() {
  return (
    <footer className="border-t border-border/60 pt-4">
      <nav
        aria-label="法的情報"
        className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-4 pb-2 text-xs text-muted-foreground"
      >
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
