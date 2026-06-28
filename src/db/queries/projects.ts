import { db } from "@/db/db";
import { projects, projectMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// 自分が参加しているプロジェクト一覧（メンバー数付き）
export async function getMyProjects(userId: string) {
  const rows = await db
    .select({
      id:          projects.id,
      name:        projects.name,
      description: projects.description,
      eventDate:   projects.eventDate,
      ownerId:     projects.ownerId,
      createdAt:   projects.createdAt,
      myRole:      projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, userId))
    .orderBy(projects.createdAt);

  return rows;
}

// プロジェクト1件（メンバー一覧付き）
export async function getProject(projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return null;

  const members = await db
    .select({
      userId:    projectMembers.userId,
      role:      projectMembers.role,
      invitedAt: projectMembers.invitedAt,
      name:      users.name,
      email:     users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId));

  return { ...project, members };
}

// 自分のロールを取得
export async function getMyRole(projectId: string, userId: string) {
  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .limit(1);

  return member?.role ?? null;
}
