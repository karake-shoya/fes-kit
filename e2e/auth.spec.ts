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
});
