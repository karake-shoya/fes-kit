# FesKit（模擬店出店管理アプリ） 設計ドキュメント

## プロジェクト概要

1回のイベントで出す模擬店を1プロジェクトとして管理するWebアプリケーション。
スマホ専用UI。ペルソナは料理好きの30代女性（技術に詳しくない）。

---

## ターゲット（ペルソナ）

- 30代女性、料理が趣味
- 将来は小料理屋を開きたい
- 少し気持ちの悪いキャラクターを好む
- 落ち着いた色合いを好む（ピンクなどの明るい色は避ける）
- UIは見てわかりやすいものを好む
- 原価計算などの数字は苦手
- **スマホのみで使用（PC表示は考慮しない）**

---

## 技術スタック

| レイヤー | 技術 | バージョン・備考 |
|---|---|---|
| フロント | Next.js (App Router) | v16系（最新stable） |
| 言語 | TypeScript | strict mode |
| UI | shadcn/ui + Tailwind CSS | react-big-calendarは使わない |
| 認証 | Clerk | |
| DB | Turso (libSQL) | SQLite互換 |
| ORM | Drizzle ORM | |
| Storage | Cloudflare R2 | 試作写真のみ（MVP後でも可） |
| デプロイ | Vercel | |
| Node.js | v22 LTS | v20以上必須 |

### Next.js 16の注意点

- `middleware.ts` → `proxy.ts` にリネームされている
- Turbopackがデフォルトバンドラー
- `cookies()` `headers()` などのrequest APIはasync対応必須
- `npx create-next-app@latest` で作成すること

---

## ディレクトリ構成

```
src/
  app/
    (auth)/
      sign-in/[[...sign-in]]/page.tsx
      sign-up/[[...sign-up]]/page.tsx
    (app)/
      dashboard/page.tsx          # プロジェクト一覧
      projects/
        [id]/
          page.tsx                # プロジェクトトップ
          ingredients/page.tsx    # 材料マスタ
          recipes/page.tsx        # レシピ一覧
          recipes/[recipeId]/page.tsx  # レシピ詳細・利益率計算
          schedule/page.tsx       # スケジュール
          prototypes/page.tsx     # 試作品記録
          settings/page.tsx       # プロジェクト設定・共有
    api/
      webhooks/
        clerk/route.ts            # Clerk Webhookエンドポイント
      invite/
        [token]/route.ts          # 招待リンク処理
  db/
    schema.ts                     # Drizzleスキーマ（全テーブル）
    db.ts                         # Turso接続
    queries/                      # クエリ関数
  lib/
    auth.ts                       # requireAuth / requireUser
  actions/                        # Server Actions
  components/
    ui/                           # shadcn/uiコンポーネント
    app/                          # アプリ独自コンポーネント
proxy.ts                          # 認証ミドルウェア（Next.js 16）
drizzle.config.ts
```

---

## 環境変数（.env.local）

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxx
CLERK_SECRET_KEY=sk_test_xxxx
CLERK_WEBHOOK_SECRET=whsec_xxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Turso
TURSO_DATABASE_URL=libsql://xxxx.turso.io
TURSO_AUTH_TOKEN=xxxx
```

---

## DBスキーマ（Drizzle ORM / Turso）

```ts
// src/db/schema.ts
import { sql } from "drizzle-orm";
import {
  text, integer, real, sqliteTable, primaryKey,
} from "drizzle-orm/sqlite-core";

// ユーザー（Clerk WebhookでINSERT/UPDATE/DELETE）
export const users = sqliteTable("users", {
  id:        text("id").primaryKey(),           // Clerk user_id をそのまま使う
  email:     text("email").notNull().unique(),
  name:      text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// プロジェクト（1イベント = 1プロジェクト）
export const projects = sqliteTable("projects", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text("name").notNull(),
  description: text("description"),
  eventDate:   text("event_date"),              // YYYY-MM-DD
  ownerId:     text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt:   text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// プロジェクトメンバー・権限管理
// role: owner = 全権限 / editor = 作成・編集・削除 / viewer = 閲覧のみ
export const projectMembers = sqliteTable("project_members", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role:      text("role", { enum: ["owner", "editor", "viewer"] }).notNull().default("viewer"),
  invitedAt: text("invited_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({ pk: primaryKey({ columns: [t.projectId, t.userId] }) }));

// 招待リンク（URLトークン方式）
export const projectInvitations = sqliteTable("project_invitations", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),  // crypto.randomUUID()で生成
  role:      text("role", { enum: ["editor", "viewer"] }).notNull().default("viewer"),
  expiresAt: text("expires_at").notNull(),      // 作成から72時間
  usedAt:    text("used_at"),                   // 使用済みなら日時が入る（使い切り）
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// 材料マスタ（プロジェクトスコープ）
export const ingredients = sqliteTable("ingredients", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),            // 材料名（例：キャベツ）
  supplier:  text("supplier"),                  // 仕入れ先
  price:     real("price").notNull(),           // 単価
  unit:      text("unit").notNull(),            // 単位（例：g, 袋, 個）
  quantity:  real("quantity").notNull(),        // 購入数量
  memo:      text("memo"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// 商品テンプレート（例：焼きそば1皿）
export const recipes = sqliteTable("recipes", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId:    text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),         // 商品名
  sellingPrice: real("selling_price").notNull(), // 販売価格（円）
  servings:     integer("servings").notNull().default(1), // 何人前 / 何個分
  memo:         text("memo"),
  createdAt:    text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt:    text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// レシピ × 材料 × 分量（中間テーブル）
// quantityUsed: ingredientsのunitに対する使用量（例：キャベツ30g → 30）
export const recipeIngredients = sqliteTable("recipe_ingredients", {
  recipeId:     text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  quantityUsed: real("quantity_used").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.recipeId, t.ingredientId] }) }));

// 試作品記録
export const prototypeLogs = sqliteTable("prototype_logs", {
  id:       text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  recipeId: text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  triedAt:  text("tried_at").notNull(),         // 試作日 YYYY-MM-DD
  result:   text("result", { enum: ["good", "needs_improvement", "failed"] })
              .notNull().default("needs_improvement"),
  memo:     text("memo"),                       // 手順・感想など自由記述
  imageUrl: text("image_url"),                  // 試作写真（Cloudflare R2）
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// スケジュール（開始日・終了日対応）
// 1日タスクは startDate === endDate
export const schedules = sqliteTable("schedules", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  startDate: text("start_date").notNull(),      // YYYY-MM-DD
  endDate:   text("end_date").notNull(),        // YYYY-MM-DD（1日タスクはstartDateと同値）
  status:    text("status", { enum: ["todo", "in_progress", "done"] })
               .notNull().default("todo"),
  memo:      text("memo"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// 型エクスポート
export type User              = typeof users.$inferSelect;
export type Project           = typeof projects.$inferSelect;
export type ProjectMember     = typeof projectMembers.$inferSelect;
export type ProjectInvitation = typeof projectInvitations.$inferSelect;
export type Ingredient        = typeof ingredients.$inferSelect;
export type Recipe            = typeof recipes.$inferSelect;
export type RecipeIngredient  = typeof recipeIngredients.$inferSelect;
export type PrototypeLog      = typeof prototypeLogs.$inferSelect;
export type Schedule          = typeof schedules.$inferSelect;
```

---

## Turso接続

```ts
// src/db/db.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = drizzle(client, { schema });
```

```ts
// drizzle.config.ts
import type { Config } from "drizzle-kit";
export default {
  schema:      "./src/db/schema.ts",
  out:         "./drizzle",
  dialect:     "turso",
  dbCredentials: {
    url:       process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
} satisfies Config;
```

---

## 認証（Clerk）

### proxy.ts（Next.js 16はmiddleware.tsではなくproxy.ts）

```ts
// proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### 認証ユーティリティ（src/lib/auth.ts）

```ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// DBアクセス不要な場面（userIdだけ必要）
export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error("認証が必要です");
  return userId;
}

// DBのusersレコードが必要な場面
// Webhookタイムラグ対策のフォールバックUPSERT込み
export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("認証が必要です");

  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existing) return existing;

  // フォールバック: Webhookが届く前にアプリを操作するケース
  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("ユーザー情報の取得に失敗しました");

  const email = clerkUser.emailAddresses
    .find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? "";
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const [upserted] = await db
    .insert(users)
    .values({ id: clerkUser.id, email, name, avatarUrl: clerkUser.imageUrl })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, name, avatarUrl: clerkUser.imageUrl, updatedAt: new Date().toISOString() },
    })
    .returning();

  return upserted;
}
```

### Clerk Webhook（src/app/api/webhooks/clerk/route.ts）

```ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses: { email_address: string; primary: boolean }[];
    first_name: string | null;
    last_name:  string | null;
    image_url:  string | null;
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "No secret" }, { status: 500 });

  const headerPayload = await headers();
  const svixId        = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature)
    return NextResponse.json({ error: "Missing headers" }, { status: 400 });

  const payload = await req.text();
  let event: ClerkUserEvent;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;
  const email = data.email_addresses.find((e) => e.primary)?.email_address ?? "";
  const name  = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

  try {
    if (type === "user.created") {
      await db.insert(users)
        .values({ id: data.id, email, name, avatarUrl: data.image_url })
        .onConflictDoNothing();                 // 冪等性：重複INSERT防止
    } else if (type === "user.updated") {
      await db.update(users)
        .set({ email, name, avatarUrl: data.image_url, updatedAt: new Date().toISOString() })
        .where(eq(users.id, data.id));
    } else if (type === "user.deleted") {
      await db.delete(users).where(eq(users.id, data.id)); // CASCADEで関連データも削除
    }
  } catch (err) {
    console.error("[clerk-webhook]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 }); // 500でClerkがリトライ
  }

  return NextResponse.json({ ok: true });
}
```

---

## 権限制御

### ロール定義

| ロール | 権限 |
|---|---|
| owner | 全操作 + メンバー管理 + プロジェクト削除 |
| editor | 材料・レシピ・スケジュール・試作記録の作成・編集・削除 |
| viewer | 閲覧のみ |

### アクセス確認関数（Server Actionsの冒頭で必ず呼ぶ）

```ts
// src/db/queries/auth.ts
import { db } from "@/db/db";
import { projectMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const ROLE_ORDER = { viewer: 0, editor: 1, owner: 2 } as const;

export async function assertProjectAccess(
  projectId: string,
  userId: string,
  requiredRole: "owner" | "editor" | "viewer" = "viewer"
) {
  const [member] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (!member) throw new Error("アクセス権がありません");
  if (ROLE_ORDER[member.role] < ROLE_ORDER[requiredRole])
    throw new Error("権限が不足しています");

  return member;
}
```

### Server Actionsでの使用パターン

```ts
"use server";
import { requireAuth } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";

// 閲覧系 → "viewer" （デフォルト）
export async function getSchedules(projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId);
  // ...
}

// 編集系 → "editor"
export async function addIngredient(projectId: string, input: {...}) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "editor");
  // ...
}

// 削除・設定系 → "owner"
export async function deleteProject(projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "owner");
  // ...
}
```

---

## 共有機能（招待リンク方式）

URLトークンで招待する（メール招待ではない）。LINEなどで送れる日常的なUXを優先。

### フロー

```
1. オーナーが権限(editor/viewer)を選んで「招待リンクを作成」
2. token = crypto.randomUUID() を生成 → project_invitationsに保存
3. /invite/[token] のURLをクリップボードにコピー
4. 招待された人がURLにアクセス → ログイン → project_membersにINSERT
5. invitation.usedAt を記録（使い切り） / expiresAt チェック（72時間）
```

### 招待リンク処理（src/app/api/invite/[token]/route.ts）

```ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { projectInvitations, projectMembers } from "@/db/schema";
import { and, eq, isNull, gt } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const { userId } = await auth();
  if (!userId) {
    // 未ログインならサインインページへ（リダイレクト後に戻ってくる）
    return NextResponse.redirect(new URL(`/sign-in?redirect_url=${req.url}`, req.url));
  }

  const [invitation] = await db
    .select()
    .from(projectInvitations)
    .where(
      and(
        eq(projectInvitations.token, params.token),
        isNull(projectInvitations.usedAt),                         // 未使用
        gt(projectInvitations.expiresAt, new Date().toISOString()) // 有効期限内
      )
    )
    .limit(1);

  if (!invitation) {
    return NextResponse.redirect(new URL("/invite/invalid", req.url));
  }

  // project_membersに追加（すでにメンバーなら無視）
  await db
    .insert(projectMembers)
    .values({ projectId: invitation.projectId, userId, role: invitation.role })
    .onConflictDoNothing();

  // 使い切り処理
  await db
    .update(projectInvitations)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(projectInvitations.id, invitation.id));

  return NextResponse.redirect(new URL(`/projects/${invitation.projectId}`, req.url));
}
```

---

## 利益率計算ロジック

DBでは計算せず、Server Action側でTypeScriptで計算する。

```ts
// レシピ1件の原価・利益率を計算
export async function getRecipeWithCost(recipeId: string, projectId: string) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId);

  const rows = await db
    .select({
      recipeId:        recipes.id,
      recipeName:      recipes.name,
      sellingPrice:    recipes.sellingPrice,
      servings:        recipes.servings,
      ingredientName:  ingredients.name,
      unit:            ingredients.unit,
      pricePerUnit:    ingredients.price,       // 購入単価
      quantityPerUnit: ingredients.quantity,    // 購入単位の個数
      quantityUsed:    recipeIngredients.quantityUsed,
    })
    .from(recipes)
    .innerJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(eq(recipes.id, recipeId));

  // 1材料あたり原価 = (購入単価 / 購入個数) × 使用量
  const totalCost = rows.reduce((sum, row) => {
    const unitCost = row.pricePerUnit / row.quantityPerUnit;
    return sum + unitCost * row.quantityUsed;
  }, 0);

  const profit     = (rows[0]?.sellingPrice ?? 0) - totalCost;
  const profitRate = rows[0]?.sellingPrice
    ? (profit / rows[0].sellingPrice) * 100
    : 0;

  return { rows, totalCost, profit, profitRate };
}
```

---

## カレンダーUI（スマホ専用）

`react-big-calendar` は使わない。スマホでは月表示が小さすぎるため。

### 構成

- **上部**：shadcn/ui の `Calendar` コンポーネント（ミニカレンダー）
  - タスクがある日にカラードット表示
  - 日付タップでその日のタスクにスクロール
- **下部**：タイムラインカードリスト
  - 左端のカラーバーでステータスを色識別
  - 期間タスクは「7/9〜7/13」と日付範囲で表示

### ステータス色定義

```ts
export const STATUS_STYLE = {
  todo:        { bar: "bg-gray-300",   label: "未着手", text: "text-gray-500"  },
  in_progress: { bar: "bg-blue-400",   label: "進行中", text: "text-blue-600"  },
  done:        { bar: "bg-green-500",  label: "完了",   text: "text-green-600" },
} as const;

// イベント当日は別途ハイライト
export const EVENT_DAY_STYLE = {
  bar: "bg-orange-400", label: "当日！", text: "text-orange-600",
};
```

---

## セットアップ手順

※ プロジェクト作成・パッケージ追加・shadcn/ui初期化は完了済み。

```bash
# 1. .env.local に環境変数を設定（上記「環境変数」セクション参照）

# 2. マイグレーション
npx drizzle-kit generate
npx drizzle-kit migrate

# 3. Clerkダッシュボードでwebhookエンドポイントを登録
#    URL: https://<your-app>.vercel.app/api/webhooks/clerk
#    イベント: user.created / user.updated / user.deleted
```

---

## 実装の優先順位（MVP）

1. 認証（Clerk + proxy.ts + Webhook同期）
2. プロジェクトCRUD + 権限管理
3. 材料マスタ管理
4. レシピ管理 + 利益率計算
5. スケジュール管理（カレンダーUI）
6. 試作品記録
7. 共有機能（招待リンク）
8. Cloudflare R2（試作写真）← MVP後でも可

