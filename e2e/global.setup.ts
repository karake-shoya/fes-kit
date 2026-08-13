import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { chromium, type FullConfig } from "@playwright/test";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  AUTH_STATE_PATH,
  E2E_DB_FILE,
  E2E_DB_URL,
  MIGRATIONS_DIR,
  getTestUserEmail,
  isLocalTarget,
} from "./env";

/**
 * E2E 全体の前準備。Playwright は webServer を起動してからここを呼ぶ
 * （runner の createGlobalSetupTasks はプラグイン＝webServer の後に globalSetup を並べる）。
 * つまりこの関数の中では dev サーバーが既に応答する。
 *
 * やることは3つ:
 *   1. Clerk の Testing Token を取る（ボット検知を通す）
 *   2. E2E 専用DBにマイグレーションを当てる（ローカル実行のときだけ）
 *   3. テストユーザーでサインインして state を保存する
 */
export default async function globalSetup(config: FullConfig) {
  // 1. Clerk の Testing Token を取得してテスト全体で使えるようにする。
  //
  // なぜ要るか: このインスタンスは bot_protection.captcha_enabled = true なので、
  // 素のヘッドレスブラウザはサインイン画面でボット検知に弾かれる。
  // Testing Token は Clerk が検証用に用意している正規の仕組みで、
  // この開発インスタンスに対してのみ有効（本番インスタンスでは効かない）。
  await clerkSetup();

  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3456";

  // 2. E2E 専用DBを作ってスキーマを当てる。
  //
  // drizzle-kit は使わない。drizzle.config.ts が dialect: "turso" で
  // file: を想定していないため。drizzle-orm 側の migrator なら
  // drizzle/meta/_journal.json を読んで同じ順で当ててくれる。
  //
  // ⚠ プレビューに当てるときは相手が Vercel 上の Turso なので何もしない。
  if (isLocalTarget(baseURL)) {
    // 毎回まっさらから始める。前回の残骸が残ると「◯個売ればトントン」のような
    // 数値の一致検証が前回のデータ次第で揺れる。
    //
    // dev サーバーは既に起動しているが、まだDBファイルを開いていない:
    // src/db/db.ts は認証後のページを描くときに初めて読み込まれ、
    // webServer の起動確認は "/" → /dashboard → proxy が /sign-in へ弾く経路で
    // 終わるためDBに触れない。最初にDBを開くのは下のサインイン後の /dashboard。
    await Promise.all(
      [E2E_DB_FILE, `${E2E_DB_FILE}-wal`, `${E2E_DB_FILE}-shm`].map((f) =>
        rm(f, { force: true }),
      ),
    );

    const client = createClient({ url: E2E_DB_URL });
    try {
      await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
    } finally {
      client.close();
    }
  }

  // 3. サインイン済みの state を作る。
  //
  // 各テストが個別にサインインすると Clerk への往復が回数ぶん増えるので、
  // ここで1回だけ通して Cookie / localStorage をファイルに残す。
  // 保存した state は WebKit・Chromium の両プロジェクトが読む。
  const email = getTestUserEmail();
  if (!email) {
    // 土台の無い環境で赤くしない。認証が要るテストは各 spec が skip する。
    console.warn(
      "[e2e] E2E_CLERK_USER_EMAIL が未設定。サインインを飛ばす（認証が要るテストは skip される）",
    );
    return;
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    // clerk.signIn は「Clerk が読み込まれている非保護ページ」に居ることを前提にする。
    // "/" は /dashboard へリダイレクトして保護に掛かるので /sign-in を使う。
    await page.goto("/sign-in");

    // メール指定の署名は Backend API でサインイントークンを発行する ticket 方式。
    // パスワードもメールのコード入力も要らない（CLERK_SECRET_KEY は .env.local から）。
    await clerk.signIn({ page, emailAddress: email });

    // サインイン直後は Cookie がまだ書かれていないことがあるので、
    // 保護ページに実際に入れることを確かめてから保存する。
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");

    await mkdir(dirname(AUTH_STATE_PATH), { recursive: true });
    await context.storageState({ path: AUTH_STATE_PATH });
  } finally {
    await browser.close();
  }
}
