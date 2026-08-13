import { expect, test } from "@playwright/test";
import { getTestUserEmail } from "./env";
import { seedProject } from "./helpers/seed";

// かかるお金（固定費）と、そこから決まる実績の「手残り」。

test.describe("かかるお金と手残り", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  // ②2（前半）かかるお金の追加・編集が動くこと
  // ※ スワイプ削除は touch の合成が要るので Step 4 で扱う。
  test("②2 かかるお金を追加でき、タップして編集できる", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({ name: `②2 ${testInfo.project.name}` });

    await page.goto(`/projects/${projectId}/expenses`);

    // 追加
    await page.getByRole("button", { name: "追加", exact: true }).click();
    const addDialog = page.getByRole("dialog");
    await addDialog.getByLabel(/費目/).fill("出店料");
    await addDialog.getByLabel(/金額/).fill("15000");
    await addDialog.getByRole("button", { name: "追加する" }).click();
    await expect(addDialog).toBeHidden();

    await expect(page.getByText("出店料")).toBeVisible();
    // 合計は1件ぶんなので同じ金額になる。
    await expect(page.getByText("かかるお金 合計")).toBeVisible();
    await expect(page.getByText("¥15,000").first()).toBeVisible();

    // 編集（カード本体をタップすると編集ダイアログが開く）
    await page.getByRole("button", { name: /出店料/ }).click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel(/金額/).fill("22000");
    await editDialog.getByRole("button", { name: "変更を保存" }).click();
    await expect(editDialog).toBeHidden();

    await expect(page.getByText("¥22,000").first()).toBeVisible();
    await expect(page.getByText("¥15,000")).toBeHidden();
  });

  // ④4 実績ページのサマリーに「かかるお金 ¥X を引いた手残り」が出ること
  //
  // この項目は「数値の一致」を見るもの。実績の入力経路そのものは別の関心なので、
  // 実績は seed で入れて、サマリーの数字だけを読む。
  // （画面から入力する形も試したが、ハイドレーション前の fill では
  //   useDraftNumberInput の draft が null のままで onBlur が何もせず、
  //   保存が1度も走らない。負荷が高いときだけ落ちる不安定なテストになった）
  test("④4 実績の手残りが「実績利益 − かかるお金」と一致する", async ({ page }, testInfo) => {
    // 1個の利益 = 500 − 200 = 300。売れた数 10個 → 実績利益 3,000。
    // かかるお金 2,000 を引いた手残りは 1,000。
    const { projectId } = await seedProject({
      name: `④4 ${testInfo.project.name}`,
      recipes: [
        { name: "焼きそば", sellingPrice: 500, servings: 100, unitCost: 200, made: 12, sold: 10 },
      ],
      expenses: [{ label: "出店料", amount: 2000 }],
    });

    await page.goto(`/projects/${projectId}/results`);

    // 実績利益がまず合っていること（手残りの元になる数字）。
    await expect(page.getByText("実績利益 合計")).toBeVisible();
    await expect(page.getByText("¥3,000").first()).toBeVisible();

    // 🔴 ここが本体。実績利益 3,000 − かかるお金 2,000 = 1,000。
    await expect(page.getByText("かかるお金 ¥2,000 を引いた手残り")).toBeVisible();
    await expect(page.getByText("¥1,000").first()).toBeVisible();
  });
});
