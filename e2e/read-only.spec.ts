import { expect, test } from "@playwright/test";
import { getTestUserEmail } from "./env";
import { seedProject } from "./helpers/seed";

// 実機確認25項目のうち、画面を読むだけで判定できるもの。
// アプリの書き込み経路（Server Action）は一切通さないので、後片付けが要らない。
//
// 🔴 各テストは自分専用のプロジェクトを seed し、その projectId の URL に閉じて検証する。
// fullyParallel かつ2ブラウザ併走で同じDB・同じ Clerk ユーザーを共有するため、
// ダッシュボードの件数のような全体状態は当てにできない。

test.describe("読み取りだけで判定できる項目", () => {
  test.skip(
    !getTestUserEmail(),
    "E2E_CLERK_USER_EMAIL が未設定。Clerk にE2E用テストユーザーを作って .env.local に設定する",
  );

  // ②1 ホームに「かかるお金」「採算シミュレーション」のカードが増え、バッジが出ること
  test("②1 プロジェクトホームにかかるお金と採算シミュレーションのカードが出る", async ({
    page,
  }, testInfo) => {
    const { projectId } = await seedProject({
      name: `②1 ${testInfo.project.name}`,
      recipes: [{ name: "焼きそば", sellingPrice: 500, servings: 100, unitCost: 200 }],
      expenses: [{ label: "出店料", amount: 20000 }],
    });

    await page.goto(`/projects/${projectId}`);

    const expenseCard = page.getByRole("link", { name: /かかるお金/ });
    const simulationCard = page.getByRole("link", { name: /採算シミュレーション/ });

    await expect(expenseCard).toBeVisible();
    await expect(simulationCard).toBeVisible();

    // バッジは「登録済みなら合計金額」「シミュレーションは必要個数」。
    // 固定費2万円 ÷ 1個あたり利益300円 = 66.7 → 切り上げ67個。
    await expect(expenseCard).toContainText("¥20,000");
    await expect(simulationCard).toContainText("67個");
  });

  // ②3 固定費が未登録のとき、シミュレーション画面が「かかるお金を登録する」案内になること
  test("②3 かかるお金が未登録ならシミュレーションが登録への案内になる", async ({
    page,
  }, testInfo) => {
    const { projectId } = await seedProject({
      name: `②3 ${testInfo.project.name}`,
      recipes: [{ name: "たこ焼き", sellingPrice: 400, servings: 80, unitCost: 150 }],
      // expenses は入れない
    });

    await page.goto(`/projects/${projectId}/simulation`);

    await expect(
      page.getByText("出店料やレンタル代を登録すると、"),
    ).toBeVisible();
    const link = page.getByRole("link", { name: "かかるお金を登録する" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `/projects/${projectId}/expenses`);

    // 案内が出ているあいだは「◯個売ればトントン」は出ない。
    await expect(page.getByText("個 売ればトントン")).toBeHidden();
  });

  // ④5 かかるお金が未登録のときは、実績サマリーが登録への案内リンクになること
  test("④5 かかるお金が未登録なら実績サマリーが登録への案内リンクになる", async ({
    page,
  }, testInfo) => {
    const { projectId } = await seedProject({
      name: `④5 ${testInfo.project.name}`,
      recipes: [{ name: "からあげ", sellingPrice: 300, servings: 50, unitCost: 100 }],
      // expenses は入れない
    });

    await page.goto(`/projects/${projectId}/results`);

    const link = page.getByRole("link", {
      name: /出店料などを登録すると手残りが分かります/,
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `/projects/${projectId}/expenses`);

    // 登録済みのときだけ出る文言は出ていないこと。
    await expect(page.getByText(/を引いた手残り/)).toBeHidden();
  });

  // ①1 タブを切り替えたとき、下部タブバーが残ったまま中身だけスケルトンになること
  //
  // 2026-08-13 の実測でわかった実際の順序（Next 16 の App Router）:
  //   1. タップ → 次の画面のデータが届くまで、前の画面が残る（タブバーも残る）
  //   2. データ到着 → URL が変わり、projects/[id]/loading.tsx のスケルトンが出る
  //   3. 本体に差し替わる
  // 「待っているあいだにスケルトンが出る」のではない。どの時点でも
  // タブバーが消えないことが、この項目の本体。
  test("①1 タブ切替でタブバーは残り、中身だけスケルトンになる", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      name: `①1 ${testInfo.project.name}`,
      // 材料を多めに入れて、材料画面の描画を重くする。
      // スケルトンが出ている時間が延びて、確実に掴めるようにするため。
      recipes: Array.from({ length: 30 }, (_, i) => ({
        name: `クレープ${i}`,
        sellingPrice: 450,
        servings: 60,
        unitCost: 180,
      })),
    });

    // 遷移中を掴むため、材料画面を取りに行く通信を操作する。
    //
    // 🔴 page.goto より前に仕掛ける。App Router はタブのリンクが表示された時点で
    // 次の画面を先読みするので、後から仕掛けても先読み済みのキャッシュが使われる。
    // 先読みは中断して「キャッシュ無し」を作り、タップ後の1本だけ遅らせる。
    let clicked = false;
    await page.route(
      (url) => url.pathname.includes("/ingredients"),
      async (route) => {
        if (!clicked) {
          await route.abort();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      },
    );

    await page.goto(`/projects/${projectId}`);

    const tabBar = page.getByRole("navigation", { name: "プロジェクト内ナビゲーション" });
    await expect(tabBar).toBeVisible();

    clicked = true;
    await tabBar.getByRole("link", { name: "材料" }).click();

    // 待っているあいだ、タブバーは消えない。
    await expect(tabBar).toBeVisible();

    // データが届いて画面が切り替わった直後は、中身がスケルトン（loading.tsx）。
    await page.waitForURL(/\/ingredients$/);
    await expect(page.locator(".animate-pulse").first()).toBeVisible();

    // 🔴 ここが本命。スケルトンが出ているあいだもタブバーは残っている。
    // これが projects/[id]/loading.tsx を置いている理由で、
    // (app)/loading.tsx だけだとタブバーごと消える。
    await expect(tabBar).toBeVisible();

    // 最後は本体が出る（スケルトンで止まっていない）。
    await expect(page.getByRole("heading", { name: "材料" })).toBeVisible();
  });

  // ⑤1 パターンが1件のときは「表で見くらべる」が閉じた状態で出ること
  test("⑤1 パターンが1件なら表で見くらべるは閉じている", async ({ page }, testInfo) => {
    const { projectId } = await seedProject({
      name: `⑤1 ${testInfo.project.name}`,
      recipes: [{ name: "かき氷", sellingPrice: 300, servings: 100, unitCost: 80 }],
      expenses: [{ label: "出店料", amount: 10000 }],
      scenarios: [{ name: "強気プラン", items: [{ sellingPrice: 400, quantity: 90 }] }],
    });

    await page.goto(`/projects/${projectId}/simulation`);

    const summary = page.getByText("表で見くらべる（商品ごとの値段と個数）");
    await expect(summary).toBeVisible();

    // details は scenarios.length >= 2 のときだけ open。1件なので閉じている＝表は隠れている。
    await expect(page.locator("details")).not.toHaveAttribute("open", /.*/);
    await expect(page.getByRole("table")).toBeHidden();
  });
});
