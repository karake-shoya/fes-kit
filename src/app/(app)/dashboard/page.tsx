import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getMyProjects } from "@/db/queries/projects";
import { CreateProjectDialog } from "@/components/app/create-project-dialog";

const ROLE_LABEL = {
  owner:  "オーナー",
  editor: "編集者",
  viewer: "閲覧者",
} as const;

export default async function DashboardPage() {
  const userId  = await requireAuth();
  const projects = await getMyProjects(userId);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-zinc-800">FesKit</h1>
      </header>

      <main className="px-4 py-6 flex flex-col gap-6 max-w-lg mx-auto">
        <CreateProjectDialog />

        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-4xl">🥢</p>
            <p className="text-zinc-500 text-sm leading-relaxed">
              まだプロジェクトがありません。<br />
              上のボタンから最初のプロジェクトを作りましょう！
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>
                  <div className="bg-white rounded-2xl border border-zinc-200 px-4 py-4 shadow-sm active:scale-[0.98] transition-transform">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-semibold text-zinc-800 truncate">{p.name}</span>
                        {p.eventDate && (
                          <span className="text-xs text-zinc-500">
                            📅 {p.eventDate.replace(/-/g, "/")}
                          </span>
                        )}
                        {p.description && (
                          <span className="text-sm text-zinc-500 line-clamp-2 mt-1">{p.description}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
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
