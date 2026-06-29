import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getProject, getMyRole } from "@/db/queries/projects";
import { ProjectSettingsForm } from "@/components/app/project-settings-form";
import { DeleteProjectButton } from "@/components/app/delete-project-button";
import { AppHeader } from "@/components/app/app-header";
import { ROLE_LABEL } from "@/lib/format";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }  = await params;
  const userId  = await requireAuth();
  const project = await getProject(id);

  if (!project) notFound();

  const myRole = await getMyRole(id, userId);
  if (!myRole) notFound();

  const canEdit   = myRole === "owner" || myRole === "editor";
  const isOwner   = myRole === "owner";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="プロジェクト設定" backHref={`/projects/${id}`} />

      <main className="px-4 py-6 flex flex-col gap-6 max-w-lg mx-auto">
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
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    {(m.name ?? m.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{m.name ?? m.email}</span>
                  {m.name && <span className="text-xs text-muted-foreground/70 truncate">{m.email}</span>}
                </div>
                <span className="ml-auto text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 shrink-0">
                  {ROLE_LABEL[m.role]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 危険操作 */}
        {isOwner && (
          <section className="bg-card rounded-2xl border border-red-200 px-4 py-4 flex flex-col gap-3">
            <h2 className="font-semibold text-red-600">危険な操作</h2>
            <p className="text-xs text-muted-foreground">プロジェクトを削除すると、材料・レシピ・スケジュール・試作記録がすべて削除されます。この操作は元に戻せません。</p>
            <DeleteProjectButton projectId={id} />
          </section>
        )}
      </main>
    </div>
  );
}
