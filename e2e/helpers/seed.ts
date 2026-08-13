import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  ingredients,
  projectExpenses,
  projectMembers,
  projects,
  recipeIngredients,
  recipes,
  salesRecords,
  simulationItems,
  simulationScenarios,
  users,
} from "../../src/db/schema";
import { AUTH_STATE_PATH, E2E_DB_URL } from "../env";

// テストの下ごしらえ。E2E専用DBへ直接 INSERT する。
//
// なぜ画面操作でセットアップしないか:
//   1. 遅い。1テストごとに何画面もクリックすることになる
//   2. 壊れたときの原因が混ざる。「検証したい画面」ではなく「準備の画面」で
//      落ちたのかが読めなくなる
// 書き込みの経路そのものを見るテスト（①4・③5 など）は Step 3 で別に立てる。

/**
 * サインイン済み state から Clerk の user_id を取り出す。
 *
 * seed したデータはこの ID に紐づける必要がある。ハードコードすると
 * テストユーザーを作り直したときに黙って通らなくなる。
 */
export function getSignedInUserId(): string {
  const state = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf8")) as {
    cookies: { name: string; value: string }[];
  };
  const session = state.cookies.find((c) => c.name === "__session");
  if (!session) {
    throw new Error(
      `${AUTH_STATE_PATH} に __session Cookie が無い。global.setup.ts のサインインが通っているか確認する`,
    );
  }
  // Clerk のセッションJWTのペイロード。sub が user_id。
  const payload = JSON.parse(
    Buffer.from(session.value.split(".")[1], "base64").toString(),
  ) as { sub?: string };
  if (!payload.sub) throw new Error("セッションJWTに sub が無い");
  return payload.sub;
}

type SeedOptions = {
  /** プロジェクト名。テストごとに一意にする（並走する他テストと混ざらないため） */
  name: string;
  eventDate?: string;
  expectedVisitors?: number;
  targetProfit?: number;
  /**
   * 商品。原価を持たせたいときは unitCost を添える。
   * made / sold を書くと当日の実績records も一緒に入る。
   */
  recipes?: {
    name: string;
    sellingPrice: number;
    servings: number;
    unitCost?: number;
    made?: number;
    sold?: number;
  }[];
  /** かかるお金（固定費） */
  expenses?: { label: string; amount: number }[];
  /** 採算パターン。items は recipes と同じ並びで対応させる */
  scenarios?: { name: string; items: { sellingPrice: number; quantity: number }[] }[];
};

export type SeededProject = {
  projectId: string;
  recipeIds: string[];
};

/**
 * テスト専用のプロジェクトを1件作る。
 *
 * 🔴 各テストは必ず自分のプロジェクトを作り、その projectId の URL に閉じて検証すること。
 * fullyParallel かつ2ブラウザ併走で同じDB・同じユーザーを共有するため、
 * ダッシュボードの件数のような全体状態にアサーションを置くと落ちる。
 */
export async function seedProject(options: SeedOptions): Promise<SeededProject> {
  const userId = getSignedInUserId();
  // timeout はロック待ちの上限（ミリ秒）。ワーカーが4本並走するので、
  // これが無いと後から来た seed が即 SQLITE_BUSY で落ちる（WAL でも書き手は1度に1つ）。
  const client = createClient({ url: E2E_DB_URL, timeout: 10_000 });
  const db = drizzle(client);

  try {
    // users は Webhook 未着でもアプリ側の requireUser() が UPSERT するが、
    // projects.owner_id の FK を通すためにここで先に入れておく。
    await db
      .insert(users)
      .values({ id: userId, email: `${userId}@e2e.local` })
      .onConflictDoNothing();

    const [project] = await db
      .insert(projects)
      .values({
        name: options.name,
        eventDate: options.eventDate,
        expectedVisitors: options.expectedVisitors,
        targetProfit: options.targetProfit,
        ownerId: userId,
      })
      .returning();

    await db
      .insert(projectMembers)
      .values({ projectId: project.id, userId, role: "owner" });

    // 🔴 まとめて1文で入れる。1行ずつ INSERT すると書き込み回数が商品数だけ増え、
    // 4ワーカーが同じSQLiteファイルを取り合って全体が詰まる（実測で顕在化した）。
    const recipeList = options.recipes ?? [];
    // 🔴 ID はこちらで採番する。まとめINSERT の RETURNING が入力と同じ並びで
    // 返る保証は無く、順序が入れ替わると「商品Aの原価に商品Bの材料が付く」
    // 「パターンの値段が別の商品に入る」といった、テストが通ったまま
    // 間違った前提で検証する事故になる。
    const recipeIds = recipeList.map(() => crypto.randomUUID());

    if (recipeList.length > 0) {
      await db.insert(recipes).values(
        recipeList.map((r, i) => ({
          id: recipeIds[i],
          projectId: project.id,
          name: r.name,
          sellingPrice: r.sellingPrice,
          servings: r.servings,
        })),
      );

      // 原価は「1個ぶんの材料費」を材料1件で表す。
      // 購入数量を1にしておけば、単価がそのまま1個あたりの原価になる。
      const withCost = recipeList
        .map((r, i) => ({ r, recipeId: recipeIds[i], ingredientId: crypto.randomUUID() }))
        .filter(({ r }) => r.unitCost !== undefined);

      if (withCost.length > 0) {
        await db.insert(ingredients).values(
          withCost.map(({ r, ingredientId }) => ({
            id: ingredientId,
            projectId: project.id,
            name: `${r.name}の材料`,
            price: r.unitCost!,
            unit: "個",
            quantity: 1,
          })),
        );

        await db.insert(recipeIngredients).values(
          withCost.map(({ recipeId, ingredientId }) => ({
            recipeId,
            ingredientId,
            quantityUsed: 1,
          })),
        );
      }
    }

    // 当日の実績（作った数・売れた数）。
    // 画面から入力する経路は別の項目で見る。ここは「入っている実績から
    // サマリーの数字が正しく出るか」を見たいときのための下ごしらえ。
    const salesRows = recipeList
      .map((r, i) => ({ r, recipeId: recipeIds[i] }))
      .filter(({ r }) => r.made !== undefined || r.sold !== undefined);
    if (salesRows.length > 0) {
      await db.insert(salesRecords).values(
        salesRows.map(({ r, recipeId }) => ({
          recipeId,
          madeCount: r.made ?? 0,
          soldCount: r.sold ?? 0,
        })),
      );
    }

    const expenseList = options.expenses ?? [];
    if (expenseList.length > 0) {
      await db.insert(projectExpenses).values(
        expenseList.map((e) => ({
          projectId: project.id,
          label: e.label,
          amount: e.amount,
        })),
      );
    }

    for (const s of options.scenarios ?? []) {
      if (s.items.length > recipeIds.length) {
        throw new Error(
          `パターン「${s.name}」の明細が ${s.items.length} 件だが、商品は ${recipeIds.length} 件しか seed していない。` +
            "items は recipes と同じ並びで対応させる。",
        );
      }
      const [scenario] = await db
        .insert(simulationScenarios)
        .values({ projectId: project.id, name: s.name, source: "manual" })
        .returning();
      await db.insert(simulationItems).values(
        s.items.map((item, i) => ({
          scenarioId: scenario.id,
          recipeId: recipeIds[i],
          sellingPrice: item.sellingPrice,
          quantity: item.quantity,
        })),
      );
    }

    return { projectId: project.id, recipeIds };
  } finally {
    client.close();
  }
}
