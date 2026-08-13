import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

// 未サインインの状態で見えるべきものだけを見るスモーク。データを1件も書き換えない。

// 🔴 サインイン済み state を外す。
// global.setup.ts が作った state を既定で読むようになったため、これを外さないと
// /sign-in がホームへリダイレクトされ「フォームが出ない」で落ちる。
test.use({ storageState: { cookies: [], origins: [] } });

test("トップページが表示される", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/feskit/i);
});

test("サインイン画面に Clerk のフォームが出る", async ({ page }) => {
  // ボット検知を通すための Testing Token を仕込む。これが無いと
  // ヘッドレスのブラウザはサインイン画面に到達できない。
  await setupClerkTestingToken({ page });

  // 失敗したときに原因を掴むため、ブラウザ側のエラーを拾っておく。
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await page.goto("/sign-in");

  const form = page.locator(".cl-signIn-root");

  // 待ち時間はテスト全体の制限時間より短くする。
  // 同着にすると、失敗した瞬間にページが閉じられて下の診断が動かない。
  try {
    await expect(form).toBeVisible({ timeout: 15_000 });
  } catch (error) {
    const alert = page.getByRole("alert").first();
    const alertText =
      (await alert.count()) > 0
        ? await alert.innerText().catch(() => "(読み取れず)")
        : "(アラート無し)";
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "(読み取れず)");

    throw new Error(
      [
        "サインインフォームが出なかった。",
        `アラート: ${alertText}`,
        `本文: ${bodyText.slice(0, 300)}`,
        `コンソールエラー: ${consoleErrors.slice(0, 5).join(" / ") || "なし"}`,
      ].join("\n"),
      { cause: error },
    );
  }

  await expect(page.locator('input[name="identifier"]')).toBeVisible();
});
