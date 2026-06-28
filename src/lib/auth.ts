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
