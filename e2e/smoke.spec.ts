import { expect, test } from "@playwright/test";

// 読み取りだけのスモーク。データを1件も書き換えない。
//
// なぜ読み取りだけで止めているか：
// Vercel の Preview が Production と同じ Turso を見ていないことを、まだ目視で確認できていない。
// 書き込みを伴うテスト（③5「これにする」など）は、そこが確定してから足す。
// 詳細は docs/2026-08-08_実機確認25項目の仕分け.md を参照。

test("トップページが表示される", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/feskit/i);
});

test("サインイン画面に Clerk のフォームが出る", async ({ page }) => {
  await page.goto("/sign-in");

  // Clerk のコンポーネントは cl- 接頭辞のクラスで描画される。
  // 文言はロケール設定で変わるため、文字列ではなく構造で確かめる。
  const form = page.locator(".cl-signIn-root");

  try {
    await expect(form).toBeVisible({ timeout: 30_000 });
  } catch (error) {
    // フォームが出ないとき、Clerk はアラートだけのページを返すことがある
    // （ボット検知に弾かれた場合など）。原因の切り分けに文言が要るので、
    // 落とす前にアラートの中身を読んでメッセージに添える。
    const alert = page.getByRole("alert").first();
    const detail =
      (await alert.count()) > 0
        ? await alert.innerText().catch(() => "(読み取れず)")
        : "(アラートも無し)";
    throw new Error(`サインインフォームが出なかった。画面のアラート: ${detail}`, {
      cause: error,
    });
  }

  await expect(page.locator('input[name="identifier"]')).toBeVisible();
});
