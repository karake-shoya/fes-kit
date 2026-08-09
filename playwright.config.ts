import { defineConfig, devices } from "@playwright/test";

// .env.local を読み込む（Node 20.12+ の標準機能。追加の依存を入れない）。
// ここから Clerk の鍵と Vercel の Protection Bypass シークレットを受け取るので、
// 実行のたびに人がシェルへ export する必要がなくなる。
// .env.local は .gitignore 済みなので、値がリポジトリに入ることはない。
try {
  process.loadEnvFile(".env.local");
} catch {
  // 無くても動く（CI ではシークレットを環境変数で渡す）
}

// @clerk/testing は CLERK_PUBLISHABLE_KEY を見る。
// Next.js 側は NEXT_PUBLIC_ 接頭辞で持っているので、無いときだけ橋渡しする。
process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// E2E の宛先。既定はローカルの dev サーバー。
// Vercel のプレビューに当てるときは E2E_BASE_URL に URL を渡す。
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isLocal = baseURL.startsWith("http://localhost");

// プレビューは Vercel Authentication で保護されているので、
// Protection Bypass のシークレットをヘッダに載せないと1リクエストも通らない。
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global.setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
    ...(bypassSecret
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": bypassSecret,
            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {}),
  },

  projects: [
    // feskit は iPhone の PWA として使うアプリなので、これを主にする。
    // devices["iPhone 13"] は WebKit エンジン＋hasTouch＋モバイル幅をまとめて満たす：
    // - WebKit: <summary> の既定マーカー二重表示（⑤2）は WebKit でしか再現しない
    // - hasTouch: スワイプ削除（②2・③4）は React.TouchEvent 実装なので touch が要る
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"] },
    },
    // 横スクロールや比較表はデスクトップ幅でも崩れないことを見たいので併走させる。
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], hasTouch: true },
    },
  ],

  // ローカルを相手にするときだけ dev サーバーを面倒みる。
  // プレビューを相手にするときは既にデプロイ済みなので起動しない。
  ...(isLocal
    ? {
        webServer: {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
