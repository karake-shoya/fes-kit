import { expect, test, type Locator, type Page } from "@playwright/test";
import { getTestUserEmail } from "./env";
import { seedProject } from "./helpers/seed";

// 採算シミュレーションと採算パターン。
// 金額と個数はすべて lib/breakeven.ts の純粋関数が出すので、
// ここでは「画面に出た数字どうしが噛み合っているか」を見る。
//
// 使う商品は原価が単純に決まる形にしてある:
//   販売価格 500 / 1個の材料費 200 → 1個の利益 300
//   かかるお金 20,000 → トントンは 20000 / 300 = 66.7 → 67個

const PRICE = 500;
const UNIT_COST = 200;
const FIXED_COST = 20_000;
const BREAKEVEN_QTY = 67;

/** 「◯個」のような表示から数値だけ取り出す。 */
function toNumber(text: string): number {
  const digits = text.replace(/[^0-9-]/g, "");
  if (digits === "") throw new Error(`数値が読めない: ${JSON.stringify(text)}`);
  return Number(digits);
}

/** ヒーローの「全部で◯個 売ればトントン」から個数を読む。 */
async function readBreakevenTotal(page: Page): Promise<number> {
  const hero = page.locator("p", { hasText: "個 売ればトントン" }).first();
  const text = await hero.innerText();
  const match = text.match(/全部で\s*([0-9,]+)\s*個/);
  if (!match) throw new Error(`ヒーローの個数が読めない: ${JSON.stringify(text)}`);
  return toNumber(match[1]);
}

/** 「商品ごとの内訳」の各行から、トントンに要る個数を読む。 */
async function readBreakdownQuantities(page: Page): Promise<number[]> {
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: "商品ごとの内訳" }),
  });
  const rows = section.locator("li");
  const texts = await rows.allInnerTexts();
  return texts.map((t) => {
    // 右側は「12個」に続けて「予定 100個」が並ぶ。前者を取る。
    const match = t.match(/([0-9,]+)個\s*\n\s*予定/);
    if (!match) throw new Error(`内訳の個数が読めない: ${JSON.stringify(t)}`);
    return toNumber(match[1]);
  });
}

/** 想定来場者数のチェック行。 */
function visitorRow(page: Page): Locator {
  return page.locator("div", { hasText: /人のうち\d+%が買う計算です/ }).last();
}

test.describe("採算シミュレーション", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  // ②4 「全部で◯個売ればトントン」が商品ごとの内訳の合計と一致すること
  test("②4 トントンの個数が商品ごとの内訳の合計と一致する", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      name: `②4 ${testInfo.project.name}`,
      recipes: [
        { name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST },
        { name: "たこ焼き", sellingPrice: 400, servings: 60, unitCost: 150 },
        { name: "かき氷", sellingPrice: 300, servings: 40, unitCost: 80 },
      ],
      expenses: [{ label: "出店料", amount: FIXED_COST }],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    const total = await readBreakevenTotal(page);
    const quantities = await readBreakdownQuantities(page);

    expect(quantities).toHaveLength(3);
    // 🔴 ここがこの項目の本体。ヒーローの数字と内訳の合計がズレていたら、
    // 「何個作ればいいか」の答えが画面の中で矛盾していることになる。
    expect(quantities.reduce((a, b) => a + b, 0)).toBe(total);
  });

  // ②5 想定来場者数を入れると購入率が出て、100%超で赤い警告になること
  test("②5 想定来場者数から購入率が出る（余裕がある場合）", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      name: `②5余裕 ${testInfo.project.name}`,
      expectedVisitors: 1000,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: FIXED_COST }],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    // 67 / 1000 = 6.7% → 7%
    await expect(
      page.getByText(`来場者1000人のうち7%が買う計算です（${BREAKEVEN_QTY}個）。`),
    ).toBeVisible();
    // 警告文は出ない。
    await expect(page.getByText(/来場者全員が1個以上買う前提になっています/)).toBeHidden();
  });

  test("②5 購入率が100%を超えると赤い警告になる", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      name: `②5超過 ${testInfo.project.name}`,
      expectedVisitors: 50,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: FIXED_COST }],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    // 67 / 50 = 134%
    await expect(page.getByText(/来場者50人のうち134%が買う計算です/)).toBeVisible();
    await expect(
      page.getByText(/来場者全員が1個以上買う前提になっています/),
    ).toBeVisible();
    // 赤くなること。色はクラスで判定する（文言だけだと見た目の退行を拾えない）。
    await expect(visitorRow(page)).toHaveClass(/text-red-700/);
  });

  test("②5 購入率がちょうど100%なら赤くならない（境界）", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      // トントンが 67個 なので、来場者を 67人 にすると購入率はちょうど100%。
      name: `②5境界 ${testInfo.project.name}`,
      expectedVisitors: BREAKEVEN_QTY,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: FIXED_COST }],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    await expect(
      page.getByText(`来場者${BREAKEVEN_QTY}人のうち100%が買う計算です（${BREAKEVEN_QTY}個）。`),
    ).toBeVisible();
    // 判定は「100%超」なので、ちょうど100%は警告にしない。
    await expect(page.getByText(/来場者全員が1個以上買う前提になっています/)).toBeHidden();
    await expect(visitorRow(page)).not.toHaveClass(/text-red-700/);
  });
});

test.describe("採算パターン", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  // ③1 「パターンで比べる」が出て「追加」でダイアログが開くこと
  // ③2 打ち替えると保存前に手残り・購入率がその場で動くこと
  // ③3 保存したカードに手残り・全体個数・購入率が出ること
  test("③1〜③3 パターンを追加すると、保存前に手残りが動きカードに反映される", async ({
    page,
  }, testInfo) => {
    const { projectId } = await seedProject({
      name: `③1-3 ${testInfo.project.name}`,
      expectedVisitors: 1000,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: FIXED_COST }],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    // ③1
    await expect(page.getByRole("heading", { name: "パターンで比べる" })).toBeVisible();
    await page.getByRole("button", { name: "追加", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // 初期値は今の商品の値段と作る予定数。
    // 500円 × 100個 − 材料費 200×100 − 固定費 20000 = 10,000
    await expect(dialog).toContainText("全部100個 売れたら手残り");
    await expect(dialog).toContainText("¥10,000");

    // ③2 保存せずに打ち替えると、その場で数字が動く。
    await dialog.getByLabel("パターン名").fill("強気プラン");
    await dialog.locator('input[name^="price-"]').fill("600");
    await dialog.locator('input[name^="qty-"]').fill("120");

    // 600×120 − 200×120 − 20000 = 28,000。購入率は 120/1000 = 12%。
    // 🔴 まだ「追加する」を押していない。保存前に結果が見えることがこの項目の要。
    await expect(dialog).toContainText("全部120個 売れたら手残り");
    await expect(dialog).toContainText("¥28,000");
    await expect(dialog).toContainText("来場者1000人のうち12%が買う計算");

    // ③3 保存したカードに手残り・全体個数・購入率が出る。
    await dialog.getByRole("button", { name: "追加する" }).click();
    await expect(dialog).toBeHidden();

    const card = page.locator("li", { hasText: "強気プラン" }).first();
    await expect(card).toContainText("¥28,000");
    await expect(card).toContainText("全部120個");
    await expect(card).toContainText("購入率 12%");
  });

  // ③5 「これにする」→確認 → 商品の値段・作る予定数が実際に書き換わること
  test("③5 これにするで商品の値段と作る予定数が書き換わる", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      name: `③5 ${testInfo.project.name}`,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: FIXED_COST }],
      scenarios: [{ name: "反映テスト", items: [{ sellingPrice: 700, quantity: 150 }] }],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    await page.getByRole("button", { name: "これにする" }).click();
    // 確認ダイアログを通す（recipes を書き換える唯一の経路なので確認を挟んでいる）。
    await page.getByRole("button", { name: "これにする", exact: true }).last().click();

    // 画面下に成功のお知らせが出る。
    await expect(page.getByText("「反映テスト」を商品に反映しました")).toBeVisible();

    // 🔴 ここが本体。パターンの値が実際の商品に書き込まれていること。
    //
    // 先に今の画面（シミュレーション）で確かめる。「これにする」の直後は
    // router.refresh() が走っているので、その結果を待たずに別ページへ飛ぶと
    // 遷移どうしがぶつかる（実測: goto が「別の遷移に割り込まれた」で落ちた）。
    const breakdown = page.locator("section", {
      has: page.getByRole("heading", { name: "商品ごとの内訳" }),
    });
    await expect(breakdown).toContainText("予定 150個");

    // 値段は商品一覧で確かめる。
    await page.goto(`/projects/${projectId}/recipes`);
    await expect(page.locator("li", { hasText: "焼きそば" }).first()).toContainText("¥700");
  });

  // ③6 パターンを5件作ると「追加」ボタンが消え、上限の案内が出ること
  test("③6 パターンが5件になると追加ボタンが消えて上限の案内が出る", async ({
    page,
  }, testInfo) => {
    const { projectId } = await seedProject({
      name: `③6 ${testInfo.project.name}`,
      recipes: [{ name: "焼きそば", sellingPrice: PRICE, servings: 100, unitCost: UNIT_COST }],
      expenses: [{ label: "出店料", amount: FIXED_COST }],
      scenarios: Array.from({ length: 5 }, (_, i) => ({
        name: `案${i + 1}`,
        items: [{ sellingPrice: 500 + i * 10, quantity: 100 }],
      })),
    });

    await page.goto(`/projects/${projectId}/simulation`);

    await expect(page.getByRole("heading", { name: "パターンで比べる" })).toBeVisible();
    await expect(page.getByRole("button", { name: "追加", exact: true })).toBeHidden();
    await expect(
      page.getByText("パターンは5件までです。新しく作るときは使わないものを削除してください。"),
    ).toBeVisible();
  });
});
