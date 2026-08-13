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
  /** 商品。原価を持たせたいときは ingredient を添える */
  recipes?: { name: string; sellingPrice: number; servings: number; unitCost?: number }[];
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
  const client = createClient({ url: E2E_DB_URL });
  const db = drizzle(client);

  try {
    // 書き込みが競合したとき即座に諦めず待つ。ワーカーが4本並走するので、
    // これが無いと後から来た seed が SQLITE_BUSY で落ちる
    // （WAL でも書き手は1度に1つ）。
    await client.execute("PRAGMA busy_timeout = 10000");

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

    const recipeIds: string[] = [];
    for (const r of options.recipes ?? []) {
      const [recipe] = await db
        .insert(recipes)
        .values({
          projectId: project.id,
          name: r.name,
          sellingPrice: r.sellingPrice,
          servings: r.servings,
        })
        .returning();
      recipeIds.push(recipe.id);

      // 原価は「1個ぶんの材料費」を材料1件で表す。
      // 購入数量を1にしておけば、単価がそのまま1個あたりの原価になる。
      if (r.unitCost !== undefined) {
        const [ingredient] = await db
          .insert(ingredients)
          .values({
            projectId: project.id,
            name: `${r.name}の材料`,
            price: r.unitCost,
            unit: "個",
            quantity: 1,
          })
          .returning();
        await db.insert(recipeIngredients).values({
          recipeId: recipe.id,
          ingredientId: ingredient.id,
          quantityUsed: 1,
        });
      }
    }

    for (const e of options.expenses ?? []) {
      await db
        .insert(projectExpenses)
        .values({ projectId: project.id, label: e.label, amount: e.amount });
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
