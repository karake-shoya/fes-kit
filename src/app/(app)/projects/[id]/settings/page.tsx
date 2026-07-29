import { notFound } from "next/navigation";
import { requireAuth, projectAccessOf } from "@/lib/auth";
import { getProject } from "@/db/queries/projects";
import { ProjectSettingsForm } from "@/components/app/project-settings-form";
import { DeleteProjectButton } from "@/components/app/delete-project-button";
import { InviteSection } from "@/components/app/invite-section";
import { AppHeader } from "@/components/app/app-header";
import { PageMain } from "@/components/app/page-shell";
import { MemberAvatar } from "@/components/app/member-avatar";
import { ROLE_LABEL, PILL_CLASS } from "@/lib/format";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [userId, project] = await Promise.all([requireAuth(), getProject(id)]);
  if (!project) notFound();

  // メンバー一覧を取得済みなので、自分のロールはそこから読む（同じ問い合わせを二度しない）
  const { canEdit, isOwner } = projectAccessOf(
    userId,
    project.members.find((m) => m.userId === userId)?.role
  );

  return (
    <>
      <AppHeader title="プロジェクト設定" backHref={`/projects/${id}`} />

      <PageMain gap={6}>
        {/* プロジェクト情報編集 */}
        <section className="bg-card rounded-2xl border border-border px-4 py-4 flex flex-col gap-4">
          <h2 className="font-semibold text-foreground">基本情報</h2>
          <ProjectSettingsForm project={project} canEdit={canEdit} />
        </section>

        {/* メンバー一覧 */}
        <section className="bg-card rounded-2xl border border-border px-4 py-4 flex flex-col gap-3">
          <h2 className="font-semibold text-foreground">メンバー ({project.members.length}人)</h2>
          <ul className="flex flex-col gap-2">
            {project.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3">
                <MemberAvatar name={m.name} email={m.email} avatarUrl={m.avatarUrl} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{m.name ?? m.email}</span>
                  {m.name && <span className="text-xs text-muted-foreground/70 truncate">{m.email}</span>}
                </div>
                <span className={`${PILL_CLASS} ml-auto shrink-0`}>
                  {ROLE_LABEL[m.role]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* メンバー招待（オーナーのみ） */}
        {isOwner && (
          <section className="bg-card rounded-2xl border border-border px-4 py-4 flex flex-col gap-3">
            <h2 className="font-semibold text-foreground">メンバーを招待</h2>
            <InviteSection projectId={id} />
          </section>
        )}

        {/* 危険操作 */}
        {isOwner && (
          <section className="bg-card rounded-2xl border border-red-200 px-4 py-4 flex flex-col gap-3">
            <h2 className="font-semibold text-red-600">危険な操作</h2>
            <p className="text-xs text-muted-foreground">プロジェクトを削除すると、材料・レシピ・スケジュール・試作記録がすべて削除されます。この操作は元に戻せません。</p>
            <DeleteProjectButton projectId={id} />
          </section>
        )}
      </PageMain>
    </>
  );
}
