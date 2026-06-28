import { sql } from "drizzle-orm";
import {
  text,
  integer,
  real,
  sqliteTable,
  primaryKey,
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
