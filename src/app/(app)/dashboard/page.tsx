import Link from "next/link";
import { UtensilsCrossed, CalendarDays } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getMyProjects } from "@/db/queries/projects";
import { CreateProjectDialog } from "@/components/app/create-project-dialog";
import { AppHeader } from "@/components/app/app-header";
import { ROLE_LABEL, formatDate } from "@/lib/format";

export default async function DashboardPage() {
  const userId  = await requireAuth();
  const projects = await getMyProjects(userId);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="FesKit" />

      <main className="px-4 py-6 flex flex-col gap-6 max-w-lg mx-auto">
        <CreateProjectDialog />

        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              まだプロジェクトがありません。<br />
              上のボタンから最初のプロジェクトを作りましょう！
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>
                  <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm active:scale-[0.98] transition-transform">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-semibold text-foreground truncate">{p.name}</span>
                        {p.eventDate && (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" /> {formatDate(p.eventDate)}
                          </span>
                        )}
                        {p.description && (
                          <span className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                        {ROLE_LABEL[p.myRole]}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
