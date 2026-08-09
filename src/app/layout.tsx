import { ClerkProvider } from "@clerk/nextjs";
import { jaJP } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import { Figtree, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// 欧文・数字はFigtree、日本語は丸ゴシックのZen Maru Gothicで表示する。
// 落ち着いた暖色パレットに合う、手作り感のある柔らかい字面にする
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

const zenMaru = Zen_Maru_Gothic({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
  display: "swap",
  // 日本語フォントはサイズが大きく unicode-range で分割配信されるため preload しない
  preload: false,
});

export const metadata: Metadata = {
  title: "FesKit",
  description: "出店の採算管理アプリ",
  appleWebApp: {
    capable: true,
    title: "FesKit",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b1a0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={cn("h-full", "antialiased", "font-sans", figtree.variable, zenMaru.variable)}
    >
      <body className="min-h-dvh flex flex-col">
        <ClerkProvider localization={jaJP} appearance={{ theme: shadcn }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}