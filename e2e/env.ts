import { dirname, join } from "node:path";

// E2E の設定値のうち、playwright.config.ts と global.setup.ts の両方が使うもの。
//
// ⚠ 環境変数は「関数越し」に読む。playwright.config.ts が .env.local を
// process.loadEnvFile() で読み込むのはモジュール本体の実行時だが、import された
// モジュールはそれより先に評価される。定数で持つと未読み込みの値を掴んでしまう。

// パスはすべてこのファイルの位置から絶対パスで組む。
//
// なぜ相対パスにしないか: Playwright はテストランナーの cwd を変えないが、
// dev サーバー（webServer）の cwd は設定ファイルのある場所になる。
// リポジトリのサブディレクトリから playwright を叩くと両者がズレ、
// 「マイグレーションを当てたDB」と「アプリが開くDB」が別ファイルになる。
const REPO_ROOT = dirname(__dirname);

// 鍵の置き場。Clerk の鍵と Vercel の Protection Bypass シークレットをここから読む。
export const ENV_LOCAL_PATH = join(REPO_ROOT, ".env.local");

// E2E 専用のローカルDB。
//
// なぜ file: なのか: .env.local の TURSO_DATABASE_URL は本番の Turso
// （libsql://fes-kit-us-…）を指している。書き込みを伴うE2E（「これにする」は
// recipes を実際に書き換える）をそのまま走らせるとパートナーの出店データを壊す。
// dev サーバーにだけ別のDBを渡し、.env.local には一切触れない。
export const E2E_DB_FILE = join(REPO_ROOT, "e2e.db");
export const E2E_DB_URL = `file:${E2E_DB_FILE}`;

// マイグレーションの置き場。drizzle/meta/_journal.json を migrator が読む。
export const MIGRATIONS_DIR = join(REPO_ROOT, "drizzle");

// サインイン済みの Cookie / localStorage の保存先。
// Clerk のセッションが入るので .gitignore 済み。
export const AUTH_STATE_PATH = join(REPO_ROOT, "e2e", ".auth", "user.json");

/**
 * E2E 用 Clerk テストユーザーのメールアドレス。
 * 未設定なら認証が要るテストは skip する（土台の無い環境で赤くしないため）。
 */
export function getTestUserEmail(): string | undefined {
  return process.env.E2E_CLERK_USER_EMAIL || undefined;
}

// AI 採算診断の相手役（e2e/ai-stub.mjs）。
// AI 呼び出しは Server Action の中で起きるのでブラウザ側では捕まえられない。
// @ai-sdk/anthropic の既定プロバイダが読む ANTHROPIC_BASE_URL をここへ向け、
// アプリのコードを変えずに差し替える。
export const AI_STUB_PORT = 3457;
export const AI_STUB_URL = `http://localhost:${AI_STUB_PORT}`;

/** ローカルの dev サーバーが相手か（プレビューに当てるときは false）。 */
export function isLocalTarget(baseURL: string): boolean {
  return baseURL.startsWith("http://localhost") || baseURL.startsWith("http://127.0.0.1");
}
