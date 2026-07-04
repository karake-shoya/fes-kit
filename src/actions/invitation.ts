"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { projectInvitations, projectMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireUser } from "@/lib/auth";
import { assertProjectAccess } from "@/db/queries/auth";
import { getValidInvitation } from "@/db/queries/invitations";

// 招待リンクの有効期限（72時間）
const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

// 招待リンクを作成する（オーナーのみ）。URLはクライアント側で組み立てる
export async function createInvitation(
  projectId: string,
  role: "editor" | "viewer"
) {
  const userId = await requireAuth();
  await assertProjectAccess(projectId, userId, "owner");

  if (role !== "editor" && role !== "viewer") {
    throw new Error("不正なロールです");
  }

  const token = crypto.randomUUID();
  await db.insert(projectInvitations).values({
    projectId,
    token,
    role,
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
    createdBy: userId,
  });

  return { token };
}

// 招待を受諾してプロジェクトに参加する（使い切り）
export async function acceptInvitation(token: string) {
  // Webhook未着でもFK制約を通せるよう requireUser でユーザーをUPSERTする
  const user = await requireUser();

  const invitation = await getValidInvitation(token);
  if (!invitation) {
    throw new Error("招待リンクが無効か、期限切れです");
  }

  // メンバー追加とトークンの使用済み化はアトミックに行う。
  // 途中でクラッシュして「1回使い切り」トークンが未消費のまま残るのを防ぐ（libSQLのbatchはトランザクション）
  await db.batch([
    db
      .insert(projectMembers)
      .values({
        projectId: invitation.projectId,
        userId: user.id,
        role: invitation.role,
      })
      .onConflictDoNothing(),
    db
      .update(projectInvitations)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(projectInvitations.id, invitation.id)),
  ]);

  revalidatePath(`/projects/${invitation.projectId}`);
  redirect(`/projects/${invitation.projectId}`);
}
