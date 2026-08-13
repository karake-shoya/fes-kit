import { defineConfig, devices } from "@playwright/test";
import {
  AUTH_STATE_PATH,
  ENV_LOCAL_PATH,
  E2E_DB_URL,
  getTestUserEmail,
  isLocalTarget,
} from "./e2e/env";

// .env.local を読み込む（Node 20.12+ の標準機能。追加の依存を入れない）。
// ここから Clerk の鍵と Vercel の Protection Bypass シークレットを受け取るので、
// 実行のたびに人がシェルへ export する必要がなくなる。
// .env.local は .gitignore 済みなので、値がリポジトリに入ることはない。
// 絶対パスで指すのは、リポジトリのサブディレクトリから叩いても読めるようにするため。
try {
  process.loadEnvFile(ENV_LOCAL_PATH);
} catch {
  // 無くても動く（CI ではシークレットを環境変数で渡す）
}

// @clerk/testing は CLERK_PUBLISHABLE_KEY を見る。
// Next.js 側は NEXT_PUBLIC_ 接頭辞で持っているので、無いときだけ橋渡しする。
process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// E2E の宛先。既定は E2E 専用ポートのローカル dev サーバー。
//
// なぜ 3000 を使わないか: 3000 には Shoya が普段の開発で起動した dev サーバーが
// 居ることがある。そちらは .env.local ＝本番の Turso を見ているので、
// 再利用してしまうと本番データを書き換える。ポートを分けたうえで
// reuseExistingServer を false にし、E2E は必ず自前で起動した
// 「別DBを渡した dev サーバー」だけを相手にする。
//
// 3456 なのは、3000 番台の先頭（3000〜3100）が他プロジェクトの dev サーバーと
// ぶつかりやすいため（2026-08-13 に 3100 が別リポの next-server で埋まっていた）。
// 埋まっていたら E2E_BASE_URL で別ポートを渡す。
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3456";
const isLocal = isLocalTarget(baseURL);

// プレビューは Vercel Authentication で保護されているので、
// Protection Bypass のシークレットをヘッダに載せないと1リクエストも通らない。
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// サインイン済み state は global.setup.ts がテストユーザーの設定時だけ作る。
// 未設定のときに storageState を指すと「ファイルが無い」で全テストが落ちるので、
// あるときだけ載せる（認証が要るテスト側は test.skip で自衛する）。
const authState = getTestUserEmail() ? { storageState: AUTH_STATE_PATH } : {};

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
      use: { ...devices["iPhone 13"], ...authState },
    },
    // 横スクロールや比較表はデスクトップ幅でも崩れないことを見たいので併走させる。
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], hasTouch: true, ...authState },
    },
  ],

  // ローカルを相手にするときだけ dev サーバーを面倒みる。
  // プレビューを相手にするときは既にデプロイ済みなので起動しない。
  ...(isLocal
    ? {
        webServer: {
          command: `npm run dev -- -p ${new URL(baseURL).port}`,
          url: baseURL,
          // 🔴 再利用しない。既に上がっているサーバーが本番DBを見ている可能性があり、
          // 「拾ってしまったら壊れる」形を残さない。
          reuseExistingServer: false,
          timeout: 120_000,
          // Next.js は既に process.env にある変数を .env.local で上書きしないので
          // （@next/env の processEnv は未定義のキーにしか代入しない）、
          // ここで渡した値が .env.local より優先される。.env.local は触らない。
          env: {
            TURSO_DATABASE_URL: E2E_DB_URL,
            TURSO_AUTH_TOKEN: "",
            // 埋め込みレプリカは常駐サーバー向けの仕組みで、file: DB とは併用しない。
            TURSO_REPLICA_PATH: "",
          },
        },
      }
    : {}),
});
