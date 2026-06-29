import { ClerkProvider } from "@clerk/nextjs";
import { jaJP } from "@clerk/localizations";
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
        <ClerkProvider localization={jaJP} appearance={{ theme: shadcn }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}