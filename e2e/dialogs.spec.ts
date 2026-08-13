import { expect, test, type Page } from "@playwright/test";
import { getTestUserEmail } from "./env";
import { seedProject } from "./helpers/seed";

/** 今日の日付（YYYY-MM-DD）。アプリの todayYmd() と同じ形式。 */
function todayYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ①4 追加・編集ダイアログ6種が従来どおり動くこと。
//
// 6種すべてが EntityFormDialog + useEntityDialog という共通シェルに載っている
// （2026-07-29 のリファクタ Phase 1）。1箇所の変更が6画面に同時に効くので、
// 退行検知としての費用対効果がいちばん高い。
//
// ここはアプリの書き込み経路（Server Action）を実際に通す。
// 検証は自分が seed したプロジェクトの中だけで完結させる。

type DialogCase = {
  /** 項目名（テスト名に出す） */
  label: string;
  /** プロジェクト直下からの相対パス */
  path: string;
  /** ダイアログを開く前に商品が要るか（試作は商品を選ぶため） */
  needsRecipe?: boolean;
  /** フォームを埋める */
  fill: (page: Page) => Promise<void>;
  /** 保存後に一覧へ反映されたことの確認 */
  expectSaved: (page: Page) => Promise<void>;
};

const CASES: DialogCase[] = [
  {
    label: "材料",
    path: "/ingredients",
    async fill(page) {
      await page.getByLabel(/材料名/).fill("キャベツ");
      await page.getByLabel(/単価/).fill("198");
      await page.getByLabel(/購入数量/).fill("1000");
      await page.getByLabel(/単位/).fill("g");
    },
    async expectSaved(page) {
      await expect(page.getByText("キャベツ")).toBeVisible();
    },
  },
  {
    label: "商品",
    path: "/recipes",
    async fill(page) {
      await page.getByLabel(/商品名/).fill("焼きそば");
      await page.getByLabel(/販売価格/).fill("500");
      await page.getByLabel(/作る予定数/).fill("100");
    },
    async expectSaved(page) {
      // 商品は作成後にその商品の詳細ページへ移動する（redirectOnCreate）。
      await page.waitForURL(/\/recipes\/[^/]+$/);
      await expect(page.getByRole("heading", { name: "焼きそば" })).toBeVisible();
    },
  },
  {
    label: "予定",
    path: "/schedule",
    async fill(page) {
      await page.getByLabel(/やること/).fill("仕込み・買い出し");
      // 予定画面は月で絞り込む。今日にしておけば必ず表示月に入る
      // （固定日にすると月が変わった時点で一覧に出てこなくなる）。
      await page.getByLabel(/開始日/).fill(todayYmd());
    },
    async expectSaved(page) {
      // 予定画面の既定はカレンダー表示で、そこには件数バッジしか出ない。
      // やることの文言は「一覧」に切り替えて確かめる。
      await page.getByRole("button", { name: "一覧" }).click();
      await expect(page.getByText("仕込み・買い出し")).toBeVisible();
    },
  },
  {
    label: "持ち物",
    path: "/checklist",
    async fill(page) {
      await page.getByLabel(/名前/).fill("テント");
    },
    async expectSaved(page) {
      await expect(page.getByText("テント")).toBeVisible();
    },
  },
  {
    label: "試作",
    path: "/prototypes",
    needsRecipe: true,
    async fill(page) {
      // 試作だけは商品を選ぶ手順が要る（ネイティブ select ではなく別モーダル）。
      await page.getByRole("button", { name: "レシピを選ぶ" }).click();
      await page.getByRole("dialog").getByText("試作のもと").click();
      await page.getByLabel(/試作日/).fill("2026-08-20");
      await page.getByLabel(/メモ/).fill("味が薄い");
    },
    async expectSaved(page) {
      await expect(page.getByText("味が薄い")).toBeVisible();
    },
  },
];

test.describe("①4 追加ダイアログ6種", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  for (const c of CASES) {
    test(`${c.label}のダイアログが開いて保存でき、一覧に反映される`, async ({ page }, testInfo) => {
      const { projectId } = await seedProject({
        name: `①4 ${c.label} ${testInfo.project.name}`,
        recipes: c.needsRecipe
          ? [{ name: "試作のもと", sellingPrice: 300, servings: 10, unitCost: 100 }]
          : undefined,
      });

      await page.goto(`/projects/${projectId}${c.path}`);

      // exact にする。持ち物画面には「買い出しリストから追加」も居るため。
      await page.getByRole("button", { name: "追加", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      await c.fill(page);
      await dialog.getByRole("button", { name: "追加する" }).click();

      await c.expectSaved(page);
    });
  }

  // 新規プロジェクトだけはダッシュボード側にあり、作成後に
  // そのプロジェクトのホームへ移動する。
  test("新規プロジェクトのダイアログが開いて保存でき、ホームへ移動する", async ({ page }, testInfo) => {
    // 並走する他テストと混ざらないよう、名前を一意にする。
    const name = `①4 新規 ${testInfo.project.name} ${testInfo.testId}`;

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "新しいプロジェクトを作る" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.getByLabel(/プロジェクト名/).fill(name);
    await dialog.getByRole("button", { name: "作成する" }).click();

    await page.waitForURL(/\/projects\/[^/]+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });
});
