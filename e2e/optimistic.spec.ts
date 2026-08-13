import { expect, test } from "@playwright/test";
import { getTestUserEmail } from "./env";
import { seedProject } from "./helpers/seed";

// ①2 楽観的更新（タップした瞬間に見た目が変わる）
// ①3 保存に失敗したら知らせて元に戻す
// ⑤2 <summary> の既定マーカーが二重に出ない（WebKit 固有）

test.describe("手応えと失敗時の巻き戻し", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  // ①2 チェックがタップした瞬間に変わること。
  //
  // 「速い」ことは測れないので、サーバーの応答をわざと止めて
  // 「応答が返る前に見た目が変わっているか」で判定する。
  // これが useOptimistic を使っているかどうかの唯一の見分け方になる。
  test("①2 チェックはサーバーの応答を待たずに変わる", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({ name: `①2 ${testInfo.project.name}` });

    await page.goto(`/projects/${projectId}/checklist`);

    // 持ち物を1件作る（チェックの対象）。
    await page.getByRole("button", { name: "追加", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/名前/).fill("テント");
    await dialog.getByRole("button", { name: "追加する" }).click();
    await expect(dialog).toBeHidden();

    const toggle = page.getByRole("button", { name: "チェックする" });
    await expect(toggle).toBeVisible();

    // 保存の通信を止める。解除するまで応答を返さない。
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) => url.pathname.includes(`/projects/${projectId}/checklist`),
      async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await held;
        await route.continue();
      },
    );

    await toggle.click();

    // 🔴 応答はまだ返っていない。それでも見た目は変わっている。
    await expect(page.getByRole("button", { name: "未チェックに戻す" })).toBeVisible();

    release();
    // 応答が返ったあともチェック済みのまま（巻き戻らない）。
    await expect(page.getByRole("button", { name: "未チェックに戻す" })).toBeVisible();
  });

  // ①3 通信できないとき「保存できませんでした」が出て表示が元に戻ること。
  //
  // ⚠ context.setOffline は実機の PWA オフラインとは経路が違う。
  // ここで守れるのは「失敗を知らせて巻き戻す」ロジックの退行までで、
  // 実機での見え方は初回だけ目視する必要がある。
  test("①3 オフラインだと保存できないことを知らせて元に戻す", async ({
    page,
    context,
  }, testInfo) => {
    const { projectId } = await seedProject({ name: `①3 ${testInfo.project.name}` });

    await page.goto(`/projects/${projectId}/checklist`);

    await page.getByRole("button", { name: "追加", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/名前/).fill("軍手");
    await dialog.getByRole("button", { name: "追加する" }).click();
    await expect(dialog).toBeHidden();

    const toggle = page.getByRole("button", { name: "チェックする" });
    await expect(toggle).toBeVisible();

    await context.setOffline(true);
    try {
      await toggle.click();

      // 失敗を知らせる。
      await expect(page.getByText("チェックを保存できませんでした")).toBeVisible();
      // 楽観的に変えた見た目が元へ戻る。
      await expect(page.getByRole("button", { name: "チェックする" })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  // ⑤2 三角マーカーが二重に出ないこと。
  //
  // Safari は <summary> の既定マーカーを ::-webkit-details-marker という
  // 別の擬似要素で描く。list-style だけ消すと Safari でだけ二重に出る。
  // この項目は WebKit でしか再現しないので mobile-webkit のみで見る。
  test("⑤2 表で見くらべるの三角マーカーが二重に出ない", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-webkit",
      "既定マーカーの二重表示は WebKit でしか再現しない",
    );

    const { projectId } = await seedProject({
      name: `⑤2 ${testInfo.project.name}`,
      recipes: [{ name: "焼きそば", sellingPrice: 500, servings: 100, unitCost: 200 }],
      expenses: [{ label: "出店料", amount: 20000 }],
      scenarios: [{ name: "案A", items: [{ sellingPrice: 550, quantity: 100 }] }],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    const summary = page.locator("summary", { hasText: "表で見くらべる" });
    await expect(summary).toBeVisible();

    // 既定のリストマーカーが消えていること。
    expect(await summary.evaluate((el) => getComputedStyle(el).listStyleType)).toBe("none");

    // 自前の矢印（ChevronRight）は1つだけ。
    const arrow = summary.locator("svg");
    await expect(arrow).toHaveCount(1);

    // 🔴 Safari 固有のマーカーは位置で判定する。
    // getComputedStyle(el, "::-webkit-details-marker") は WebKit では空文字しか
    // 返さないので、計算値では「消えているか」を確かめられない（実測）。
    // 代わりに、自前の矢印が summary の左端（padding ぶんだけ内側）から
    // 始まっているかを見る。既定マーカーが残っていれば、その幅ぶん右へずれる。
    const summaryBox = await summary.boundingBox();
    const arrowBox = await arrow.boundingBox();
    if (!summaryBox || !arrowBox) throw new Error("位置が取れない");

    // summary の左パディングは px-1（4px）。マーカーが出ていれば十数px ずれる。
    expect(arrowBox.x - summaryBox.x).toBeLessThan(8);
  });
});
