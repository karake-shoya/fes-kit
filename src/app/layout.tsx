import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FesKit",
  description: "模擬店出店管理アプリ",
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
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", figtree.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <header className="flex items-center justify-end gap-3 px-4 py-3 border-b border-zinc-200">
            <Show when="signed-out">
              <SignInButton mode="redirect">
                <button className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-100 transition-colors">
                  ログイン
                </button>
              </SignInButton>
              <SignUpButton mode="redirect">
                <button className="rounded-md px-4 py-2 text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 transition-colors">
                  新規登録
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}