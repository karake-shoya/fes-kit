import { expect, test, type APIRequestContext } from "@playwright/test";
import { AI_STUB_URL, getTestUserEmail } from "./env";
import { seedProject } from "./helpers/seed";

// ④1〜④3 AI採算診断。
//
// 🔴 本物の Claude API は叩かない。呼び出しは Server Action の中で起きるので
// ブラウザ側の page.route では捕まえられず、dev サーバーの外向き通信ごと
// e2e/ai-stub.mjs へ向けている（ANTHROPIC_BASE_URL）。
// テストは /__set で「次に返す提案」を差し込む。

const PRICE = 500;
const UNIT_COST = 200;

/**
 * 「この商品IDを含む相談にはこの提案を返す」をスタブへ登録する。
 *
 * 商品IDを鍵にするのは、スタブが1つで2ブラウザぶんのテストが並走するため。
 * 「次に返す1件」を持たせると、後から登録した側が相手のぶんを上書きしてしまう。
 */
async function setAdvice(
  request: APIRequestContext,
  advice: { items: { recipeId: string; sellingPrice: number; quantity: number }[]; reason: string },
): Promise<void> {
  await request.post(`${AI_STUB_URL}/__set`, {
    data: { key: advice.items[0].recipeId, advice },
  });
}

test.describe("AI採算診断", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  // ④1 「AIに値段と個数を相談する」が出て、押すと提案が返ること
  // ④2 検算結果（手残り・個数・購入率）が一番上に大きく、AIの文章はその下にあること
  test("④1・④2 相談すると検算結果が先に出て、AIの文章はその下に出る", async ({
    page,
    request,
  }, testInfo) => {
    const { projectId, recipeIds } = await seedProject({
      name: `④1-2 ${testInfo.project.name}`,
      expectedVisitors: 1000,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: 20000 }],
    });

    // 600円 × 120個 − 材料費 200×120 − 固定費 20000 = 28,000。購入率 120/1000 = 12%。
    await setAdvice(request, {
      items: [{ recipeId: recipeIds[0], sellingPrice: 600, quantity: 120 }],
      reason: "少し値上げして数を増やすと、無理なく手元に残ります。",
    });

    await page.goto(`/projects/${projectId}/simulation`);

    const askButton = page.getByRole("button", { name: "AIに値段と個数を相談する" });
    await expect(askButton).toBeVisible();
    await askButton.click();

    const aiText = page.getByText("少し値上げして数を増やすと、無理なく手元に残ります。");
    await expect(aiText).toBeVisible();

    // 🔴 数字はコードが計算したもの。AIには金額を作らせていない。
    const verified = page.getByText("この案で全部120個 売れたら手残り");
    await expect(verified).toBeVisible();
    await expect(page.getByText("¥28,000")).toBeVisible();
    await expect(page.getByText(/購入率 12%/)).toBeVisible();

    // 🔴 検算結果がAIの文章より上にあること。
    // 「数字の出どころはコードだけ」という約束を画面の並びでも守る。
    const verifiedBox = await verified.boundingBox();
    const aiBox = await aiText.boundingBox();
    if (!verifiedBox || !aiBox) throw new Error("位置が取れない");
    expect(verifiedBox.y).toBeLessThan(aiBox.y);
  });

  // ④2（後半）赤字の提案でも、AIの前向きな文章より検算の警告を優先して出すこと
  test("④2 赤字の提案には警告が出る（AIの文章が前向きでも）", async ({
    page,
    request,
  }, testInfo) => {
    const { projectId, recipeIds } = await seedProject({
      name: `④2赤字 ${testInfo.project.name}`,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: 20000 }],
    });

    // 300円 × 50個 − 材料費 200×50 − 固定費 20000 = −15,000（赤字）。
    // 2026-07-29 の実測で、実APIは赤字案を前向きな文章付きで返すことが分かっている。
    await setAdvice(request, {
      items: [{ recipeId: recipeIds[0], sellingPrice: 300, quantity: 50 }],
      reason: "利益率を確保しつつ、お客様に手に取ってもらいやすい価格です。",
    });

    await page.goto(`/projects/${projectId}/simulation`);
    await page.getByRole("button", { name: "AIに値段と個数を相談する" }).click();

    await expect(page.getByText("この案で全部50個 売れたら手残り")).toBeVisible();
    await expect(page.getByText("-¥15,000")).toBeVisible();
    // 前向きな文章はそのまま出るが、警告が併記される。
    await expect(page.getByText(/利益率を確保しつつ/)).toBeVisible();
    await expect(page.getByText(/赤字/)).toBeVisible();
  });

  // ④3 「この案をパターンに保存する」でパターン一覧に増えること
  test("④3 提案をパターンとして保存できる", async ({ page, request }, testInfo) => {
    const { projectId, recipeIds } = await seedProject({
      name: `④3 ${testInfo.project.name}`,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: 20000 }],
    });

    await setAdvice(request, {
      items: [{ recipeId: recipeIds[0], sellingPrice: 600, quantity: 120 }],
      reason: "この値段なら無理がありません。",
    });

    await page.goto(`/projects/${projectId}/simulation`);

    // 保存前はパターンが0件。
    await expect(page.getByText(/値段と売る個数を変えた案を保存して/)).toBeVisible();

    await page.getByRole("button", { name: "AIに値段と個数を相談する" }).click();
    await page.getByRole("button", { name: "この案をパターンに保存する" }).click();

    await expect(page.getByText("AIの提案をパターンに保存しました")).toBeVisible();
    await expect(page.locator("li", { hasText: "AIの提案" })).toHaveCount(1);
  });
});
