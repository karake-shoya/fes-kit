import { notFound } from "next/navigation";
import { CookingPot, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getPrototypes } from "@/db/queries/prototypes";
import { getMyRole } from "@/db/queries/projects";
import { getRecipeNames } from "@/db/queries/recipes";
import { PrototypeDialog } from "@/components/app/prototype-dialog";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { RESULT_LABEL } from "@/lib/prototype";
import { formatDate } from "@/lib/format";
import type { PrototypeWithRecipe } from "@/db/queries/prototypes";

export default async function PrototypesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireAuth();

  const [myRole, list, recipes] = await Promise.all([
    getMyRole(id, userId),
    getPrototypes(id),
    getRecipeNames(id),
  ]);
  if (!myRole) notFound();

  const canEdit = myRole === "owner" || myRole === "editor";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="試作記録"
        backHref={`/projects/${id}`}
        action={
          canEdit && (
            <PrototypeDialog projectId={id} recipes={recipes}>
              <Button size="sm">
                <Plus className="w-4 h-4" /> 追加
              </Button>
            </PrototypeDialog>
          )
        }
      />

      <main className="px-4 py-6 flex flex-col gap-3 max-w-lg mx-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CookingPot className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              まだ試作記録がありません。<br />
              {canEdit
                ? "「追加」ボタンで試作の感想を記録しましょう！"
                : "編集者が試作記録を追加するとここに表示されます。"}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((p) => (
              <PrototypeCard key={p.id} prototype={p} projectId={id} recipes={recipes} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function PrototypeCard({
  prototype,
  projectId,
  recipes,
  canEdit,
}: {
  prototype: PrototypeWithRecipe;
  projectId: string;
  recipes: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const badge = RESULT_LABEL[prototype.result];
  const BadgeIcon = badge.Icon;
  const memoPreview = prototype.memo
    ? prototype.memo.length > 40
      ? prototype.memo.slice(0, 40) + "…"
      : prototype.memo
    : null;

  return (
    <li>
      <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-foreground truncate">{prototype.recipeName}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(prototype.triedAt)}
            </span>
          </div>
          <div className={`shrink-0 flex flex-col items-end gap-0.5 ${badge.color}`}>
            <BadgeIcon className="w-5 h-5" />
            <span className="text-xs font-medium">{badge.label}</span>
          </div>
        </div>

        {prototype.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prototype.imageUrl}
            alt={`${prototype.recipeName}の試作写真`}
            loading="lazy"
            className="w-full rounded-xl object-cover max-h-48"
          />
        )}

        {memoPreview && (
          <p className="text-sm text-muted-foreground leading-relaxed">{memoPreview}</p>
        )}

        {canEdit && (
          <div className="flex justify-end mt-1">
            <PrototypeDialog projectId={projectId} recipes={recipes} prototype={prototype}>
              <button className="text-xs text-muted-foreground/70 hover:text-foreground px-2 py-1">
                編集
              </button>
            </PrototypeDialog>
          </div>
        )}
      </div>
    </li>
  );
}
