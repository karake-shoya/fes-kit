import Image from "next/image";
import { User, Users } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getMyProjects } from "@/db/queries/projects";
import { CreateProjectDialog } from "@/components/app/create-project-dialog";
import { AppHeader } from "@/components/app/app-header";
import { PageMain } from "@/components/app/page-shell";
import { ProjectCard, type ProjectRow } from "@/components/app/project-card";
import { ChangelogSection } from "@/components/app/changelog-section";
import { todayYmd } from "@/lib/format";

// イベントが近いものを上に並べる。
// 未来のイベント（近い順）→ 日付未設定（作成順）→ 終了済み（新しい順）
function sortByEventDate(projects: ProjectRow[], today: string): ProjectRow[] {
  const upcoming = projects
    .filter((p) => p.eventDate && p.eventDate >= today)
    .sort((a, b) => a.eventDate!.localeCompare(b.eventDate!));
  const undated = projects.filter((p) => !p.eventDate);
  const past = projects
    .filter((p) => p.eventDate && p.eventDate < today)
    .sort((a, b) => b.eventDate!.localeCompare(a.eventDate!));
  return [...upcoming, ...undated, ...past];
}

export default async function DashboardPage() {
  const userId  = await requireAuth();
  const today   = todayYmd();
  const allProjects   = await getMyProjects(userId);
  const ownProjects   = sortByEventDate(allProjects.filter((p) => p.myRole === "owner"), today);
  const sharedProjects = sortByEventDate(allProjects.filter((p) => p.myRole !== "owner"), today);
  const hasShared = sharedProjects.length > 0;

  return (
    <>
      <AppHeader title="FesKit" />

      <PageMain gap={6}>
        <CreateProjectDialog />

        {allProjects.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <Image
              src="/mascot.png"
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 object-contain opacity-80"
            />
            <p className="text-muted-foreground text-sm leading-relaxed">
              まだプロジェクトがありません。<br />
              上のボタンから最初のプロジェクトを作りましょう！
            </p>
          </div>
        ) : hasShared ? (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                <User className="w-4 h-4 text-primary" /> 自分のプロジェクト
              </h2>
              <ul className="flex flex-col gap-3">
                {ownProjects.map((p) => (
                  <li key={p.id}>
                    <ProjectCard project={p} today={today} showOwner={false} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" /> 共有プロジェクト
              </h2>
              <ul className="flex flex-col gap-3">
                {sharedProjects.map((p) => (
                  <li key={p.id}>
                    <ProjectCard project={p} today={today} showOwner={true} />
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <ul className="flex flex-col gap-3">
            {ownProjects.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} today={today} showOwner={false} />
              </li>
            ))}
          </ul>
        )}

        <ChangelogSection />
      </PageMain>
    </>
  );
}
