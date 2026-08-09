import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

// 読み取りだけのスモーク。データを1件も書き換えない。
//
// なぜ読み取りだけで止めているか：
// 書き込みを伴うテスト（③5「これにする」など）は、Preview 専用DBへの切り替えを
// 実測で確認してから足す。詳細は docs/2026-08-08_実機確認25項目の仕分け.md を参照。

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
