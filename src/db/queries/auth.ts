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
