import { expect, test } from "@playwright/test";

// 特商法・利用規約・プライバシーポリシーは、ログインしていなくても
// 読めなければならない（契約前に確認できる必要があるため）。
// 未サインインの state で開くスモーク。データは1件も書き換えない。
test.use({ storageState: { cookies: [], origins: [] } });

const PAGES = [
  { path: "/legal/tokushoho", heading: "特定商取引法に基づく表記" },
  { path: "/legal/terms", heading: "利用規約" },
  { path: "/legal/privacy", heading: "プライバシーポリシー" },
];

for (const { path, heading } of PAGES) {
  test(`${path} がログアウト状態で表示される`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}

test("3ページが互いにリンクしている", async ({ page }) => {
  await page.goto("/legal/tokushoho");

  for (const { path, heading } of PAGES) {
    await expect(page.getByRole("link", { name: heading }).first()).toHaveAttribute(
      "href",
      path
    );
  }
});
