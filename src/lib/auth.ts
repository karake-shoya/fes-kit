import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertProjectAccess } from "@/db/queries/auth";
import { getMyRole } from "@/db/queries/projects";
import type { ProjectMember } from "@/db/schema";

type Role = ProjectMember["role"];

// プロジェクト内でのロールと、そこから決まる操作可否
export type ProjectAccess = {
  userId:  string;
  role:    Role;
  canEdit: boolean;  // owner / editor
  isOwner: boolean;
};

function toAccess(userId: string, role: Role): ProjectAccess {
  return { userId, role, canEdit: role !== "viewer", isOwner: role === "owner" };
}

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

// --- プロジェクト単位の認可 ---------------------------------------------------
// ページ（Server Component）とServer Actionで扱いが違う:
//   ページ  … 権限が無ければ存在を隠す（notFound）
//   アクション … 例外を投げて呼び出し元のエラー表示に載せる

/**
 * ページ用。ログイン確認とロール取得をまとめ、メンバーでなければ notFound() する。
 *
 * 本体データの取得と直列にならないよう、await せず Promise.all に渡して使う:
 *   const access = requireProjectPage(id);
 *   const [{ canEdit }, list] = await Promise.all([access, getIngredients(id)]);
 */
export async function requireProjectPage(projectId: string): Promise<ProjectAccess> {
  const userId = await requireAuth();
  const role   = await getMyRole(projectId, userId);
  if (!role) notFound();
  return toAccess(userId, role);
}

/**
 * ページ用（ロールが既知の場合）。
 * メンバー一覧を取得済みのホーム画面など、同じメンバーシップを二度引かないために使う。
 */
export function projectAccessOf(userId: string, role: Role | undefined): ProjectAccess {
  if (!role) notFound();
  return toAccess(userId, role);
}

/**
 * Server Action 用。ログイン確認と必要ロールの検証をまとめる。
 * 権限が足りなければ assertProjectAccess が例外を投げる。
 */
export async function requireProjectRole(
  projectId: string,
  requiredRole: Role = "editor"
): Promise<string> {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, requiredRole);
  return userId;
}
