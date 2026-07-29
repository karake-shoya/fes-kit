import { sql } from "drizzle-orm";
import {
  text,
  integer,
  real,
  sqliteTable,
  primaryKey,
  index,
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
  // 想定来場者数。採算シミュレーションで「何人に1人が買う想定か（購入率）」の
  // 分母に使い、非現実的な販売個数を警告する。未入力なら購入率は出さない
  expectedVisitors: integer("expected_visitors"),
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
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.userId] }),
  userIdIdx: index("idx_project_members_user_id").on(t.userId),
}));

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
}, (t) => ({
  projectIdIdx: index("idx_ingredients_project_id").on(t.projectId),
}));

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
}, (t) => ({
  projectIdIdx: index("idx_recipes_project_id").on(t.projectId),
}));

// レシピ × 材料 × 分量（中間テーブル）
// quantityUsed: ingredientsのunitに対する使用量（例：キャベツ30g → 30）
export const recipeIngredients = sqliteTable("recipe_ingredients", {
  recipeId:     text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  quantityUsed: real("quantity_used").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.recipeId, t.ingredientId] }),
  // recipeId は複合PKの先頭列のためSQLiteが自動生成する索引でカバー済み。ingredientId（2列目）のみ追加索引が必要
  ingredientIdIdx: index("idx_recipe_ingredients_ingredient_id").on(t.ingredientId),
}));

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
}, (t) => ({
  recipeIdIdx: index("idx_prototype_logs_recipe_id").on(t.recipeId),
}));

// 当日の売上・実績記録（1レシピにつき当日1レコード、都度上書き）
// 見込み利益（cost.profit × servings）と実績利益（cost.profit × soldCount）の比較に使う
export const salesRecords = sqliteTable("sales_records", {
  recipeId:  text("recipe_id").primaryKey().references(() => recipes.id, { onDelete: "cascade" }),
  madeCount: integer("made_count").notNull().default(0), // 作った数
  soldCount: integer("sold_count").notNull().default(0), // 売れた数
  memo:      text("memo"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
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
}, (t) => ({
  projectIdIdx: index("idx_schedules_project_id").on(t.projectId),
}));

// 持ち物・準備チェックリスト（プロジェクトスコープ）
// category: tool=道具 / ingredient=材料 / document=書類
export const checklistItems = sqliteTable("checklist_items", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  label:     text("label").notNull(),
  category:  text("category", { enum: ["tool", "ingredient", "document"] })
               .notNull().default("tool"),
  checked:   integer("checked", { mode: "boolean" }).notNull().default(false),
  memo:      text("memo"), // 買い出しリストからの一括インポート時のみ、必要量のスナップショットを自動セット
  // 買い出しリストからインポートした行だけ紐づく。再インポート時の重複防止に使う（手動追加はnull）
  sourceIngredientId: text("source_ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  projectIdIdx: index("idx_checklist_items_project_id").on(t.projectId),
}));

// かかるお金（個数に比例しない費用＝固定費。出店料・テントレンタル・ガスボンベなど）
// 材料費と違い商品に紐づかないため、プロジェクト単位のリストとして持つ。
// 容器・割り箸のような1個ごとにかかる費用は、材料マスタ側に登録して原価に含める
export const projectExpenses = sqliteTable("project_expenses", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  label:     text("label").notNull(),           // 費目名（例：出店料）
  amount:    real("amount").notNull(),          // 金額（円）
  memo:      text("memo"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  projectIdIdx: index("idx_project_expenses_project_id").on(t.projectId),
}));

// 採算パターン（「この価格でこれだけ売ったらどうなるか」の案）
// 実データを汚さずに試すための入れ物。「これにする」で明示的に recipes へ書き戻すまで、
// recipes.sellingPrice / servings には一切触らない
export const simulationScenarios = sqliteTable("simulation_scenarios", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),            // パターン名（例：強気プラン）
  // manual = 自分で入力 / ai = AI診断の提案（AI由来だと分かるようにする）
  source:    text("source", { enum: ["manual", "ai"] }).notNull().default("manual"),
  memo:      text("memo"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  projectIdIdx: index("idx_simulation_scenarios_project_id").on(t.projectId),
}));

// パターンの明細（1商品1行）。
// 原価は保存しない — 材料マスタの最新値で毎回計算し直す（「今の材料費だとこの案はどうか」を見る道具）
export const simulationItems = sqliteTable("simulation_items", {
  scenarioId:   text("scenario_id").notNull().references(() => simulationScenarios.id, { onDelete: "cascade" }),
  recipeId:     text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  sellingPrice: real("selling_price").notNull(),
  quantity:     integer("quantity").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.scenarioId, t.recipeId] }),
  // scenarioId は複合PKの先頭列のためSQLiteの自動索引でカバー済み。recipeId のみ追加索引が必要
  recipeIdIdx: index("idx_simulation_items_recipe_id").on(t.recipeId),
}));

// 型エクスポート
export type User              = typeof users.$inferSelect;
export type Project           = typeof projects.$inferSelect;
export type ProjectMember     = typeof projectMembers.$inferSelect;
export type ProjectInvitation = typeof projectInvitations.$inferSelect;
export type Ingredient        = typeof ingredients.$inferSelect;
export type Recipe            = typeof recipes.$inferSelect;
export type RecipeIngredient  = typeof recipeIngredients.$inferSelect;
export type PrototypeLog      = typeof prototypeLogs.$inferSelect;
export type SalesRecord       = typeof salesRecords.$inferSelect;
export type Schedule          = typeof schedules.$inferSelect;
export type ChecklistItem     = typeof checklistItems.$inferSelect;
export type ProjectExpense    = typeof projectExpenses.$inferSelect;
export type SimulationScenario = typeof simulationScenarios.$inferSelect;
export type SimulationItem     = typeof simulationItems.$inferSelect;
