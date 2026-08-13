import { expect, test } from "@playwright/test";
import { getTestUserEmail } from "./env";

// 認証の壁を越えられたことの証明。
//
// feskit の実機確認25項目はすべて Clerk 認証後の画面にあり、E2E はこれまで
// サインイン画面までしか到達していなかった。ここが緑なら、残りの項目を
// 機械に渡せる状態になったことになる。
//
// サインイン自体は global.setup.ts が1回だけ行い、その state を読んでいる。

test.describe("サインイン済みの状態", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  test("保護ページ /dashboard に入れて、サインイン画面へ弾かれない", async ({ page }) => {
    await page.goto("/dashboard");

    // 弾かれていれば /sign-in に居る。ここが最も重要な判定。
    await expect(page).toHaveURL(/\/dashboard$/);

    // ホームの中身が実際に描かれていること。
    // データの有無に左右されない2つで見る（この2つは常に出る）。
    await expect(page.getByRole("heading", { name: "FesKit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新しいプロジェクトを作る" })).toBeVisible();
  });

  test("毎回まっさらなDBから始まる（プロジェクトが0件）", async ({ page }) => {
    // global.setup.ts が実行のたびに e2e.db を作り直すので、ホームは空から始まる。
    //
    // ⚠ これは「本番DBを見ていない」ことの証明にはならない。テストユーザーは
    // 新規なので本番DBでも0件だから。DBの差し替えが効いていることは
    // 2026-08-13 に別途実測した（e2e.db へ直接入れたプロジェクトがホームに出た）。
    // Step 3 の書き込みテストが入れば、その実測が常設の判定になる。
    //
    // ⚠ 書き込みテストを足したら、並走する他テストが作ったプロジェクトを
    // 拾いうるので、この判定は serial 化するか専用ユーザーに分けること。
    await page.goto("/dashboard");

    await expect(page.getByText("まだプロジェクトがありません。")).toBeVisible();
  });
});
