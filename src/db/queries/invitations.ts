import { db } from "@/db/db";
import { projectInvitations, projects } from "@/db/schema";
import { and, eq, isNull, gt } from "drizzle-orm";

// 有効な招待（未使用・期限内）をトークンで1件取得する。
// 受諾画面でプロジェクト名を見せられるよう projects を結合して返す。
export async function getValidInvitation(token: string) {
  const [row] = await db
    .select({
      id:          projectInvitations.id,
      projectId:   projectInvitations.projectId,
      role:        projectInvitations.role,
      projectName: projects.name,
      eventDate:   projects.eventDate,
    })
    .from(projectInvitations)
    .innerJoin(projects, eq(projects.id, projectInvitations.projectId))
    .where(
      and(
        eq(projectInvitations.token, token),
        isNull(projectInvitations.usedAt),
        gt(projectInvitations.expiresAt, new Date().toISOString())
      )
    )
    .limit(1);

  return row ?? null;
}
