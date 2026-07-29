import type { LucideIcon } from "lucide-react";

// 画面本文の共通枠。スマホ幅に収め、左右の余白と縦のリズムを全画面で揃える
export function PageMain({
  children,
  gap = 3,
}: {
  children: React.ReactNode;
  /** カード間の余白（Tailwind の gap-N）。画面の情報量に合わせて 3〜6 を使う */
  gap?: 3 | 4 | 6;
}) {
  const gapClass = { 3: "gap-3", 4: "gap-4", 6: "gap-6" }[gap];
  return (
    <main className={`px-4 py-6 flex flex-col ${gapClass} max-w-lg mx-auto`}>
      {children}
    </main>
  );
}

// まだ何も登録されていない画面の案内。
// アイコン＋やさしい一言で「次に何をすればいいか」を示す
export function EmptyState({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Icon className="w-12 h-12 text-muted-foreground/40" />
      <p className="text-muted-foreground text-sm leading-relaxed">{children}</p>
    </div>
  );
}
