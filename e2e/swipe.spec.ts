import { expect, test } from "@playwright/test";
import { getTestUserEmail } from "./env";
import { seedProject } from "./helpers/seed";
import { swipeLeft } from "./helpers/swipe";

// ②2（後半）・③4 スワイプ削除。
//
// swipe-action-card.tsx は React.TouchEvent 実装なので、touch を持つ環境でしか動かない。
// mobile-webkit は iPhone 13 プロファイルで hasTouch、desktop-chromium は
// playwright.config.ts で hasTouch: true を明示している。

test.describe("スワイプ削除", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  // ②2（後半）かかるお金のスワイプ削除
  test("②2 かかるお金を左スワイプして削除できる", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      name: `②2スワイプ ${testInfo.project.name}`,
      expenses: [
        { label: "出店料", amount: 15000 },
        { label: "テント代", amount: 8000 },
      ],
    });

    await page.goto(`/projects/${projectId}/expenses`);
    await expect(page.getByText("テント代")).toBeVisible();

    const card = page.locator("li", { hasText: "テント代" }).first();
    await swipeLeft(card);

    // 半分以上引くと削除ボタンが押せるようになる。
    const deleteButton = card.getByRole("button", { name: /削除/ });
    await deleteButton.click();

    // 誤操作で消えないよう確認を挟む。
    await page.getByRole("button", { name: "削除する" }).click();

    // 一覧のカードで見る。文言だけで見ると確認ダイアログの本文まで拾ってしまう。
    await expect(page.locator("li", { hasText: "テント代" })).toHaveCount(0);
    // 巻き添えで消えていないこと。
    await expect(page.locator("li", { hasText: "出店料" })).toHaveCount(1);
  });

  // ③4 採算パターンのカードをタップで編集、左スワイプで削除
  test("③4 パターンをタップで編集でき、左スワイプで削除できる", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      name: `③4 ${testInfo.project.name}`,
      recipes: [{ name: "焼きそば", sellingPrice: 500, servings: 100, unitCost: 200 }],
      expenses: [{ label: "出店料", amount: 20000 }],
      scenarios: [
        { name: "のこす案", items: [{ sellingPrice: 550, quantity: 100 }] },
        { name: "けす案", items: [{ sellingPrice: 600, quantity: 90 }] },
      ],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    // タップで編集ダイアログが開く。
    await page.locator("li", { hasText: "のこす案" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("パターン名")).toHaveValue("のこす案");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // 左スワイプで削除。
    const card = page.locator("li", { hasText: "けす案" }).first();
    await swipeLeft(card);
    await card.getByRole("button", { name: /削除/ }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    // パターン名は比較表の列見出しにも出るので、一覧のカードで数える。
    await expect(page.locator("li", { hasText: "けす案" })).toHaveCount(0);
    await expect(page.locator("li", { hasText: "のこす案" })).toHaveCount(1);
  });
});
