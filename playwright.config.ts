import { defineConfig, devices } from "@playwright/test";

// E2E の宛先。既定はローカルの dev サーバー。
// Vercel のプレビューに当てるときは E2E_BASE_URL に URL を渡す。
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isLocal = baseURL.startsWith("http://localhost");

// プレビューは Vercel Authentication で保護されているので、
// Protection Bypass のシークレットをヘッダに載せないと1リクエストも通らない。
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "e2e",
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
