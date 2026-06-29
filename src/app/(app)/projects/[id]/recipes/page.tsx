import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getRecipes } from "@/db/queries/recipes";
import { getMyRole } from "@/db/queries/projects";
import { RecipeDialog } from "@/components/app/recipe-dialog";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { formatYen, profitStyle } from "@/lib/format";

export default async function RecipesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireAuth();

  // role判定とレシピ取得は独立なので並列実行する
  const [myRole, list] = await Promise.all([
    getMyRole(id, userId),
    getRecipes(id),
  ]);
  if (!myRole) notFound();

  const canEdit = myRole === "owner" || myRole === "editor";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="レシピ"
        backHref={`/projects/${id}`}
        action={
          canEdit && (
            <RecipeDialog projectId={id} redirectOnCreate>
              <Button size="sm">
                <Plus className="w-4 h-4" /> 追加
              </Button>
            </RecipeDialog>
          )
        }
      />

      <main className="px-4 py-6 flex flex-col gap-3 max-w-lg mx-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              まだ商品がありません。<br />
              {canEdit
                ? "「追加」ボタンで商品を登録しましょう！"
                : "編集者が商品を登録するとここに表示されます。"}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map(({ recipe, cost, ingredientCount }) => {
              const hasCost = ingredientCount > 0;
              const style   = profitStyle(cost.profitRate, hasCost);

              return (
                <li key={recipe.id}>
                  <Link href={`/projects/${id}/recipes/${recipe.id}`}>
                    <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm active:scale-[0.98] transition-transform">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-semibold text-foreground truncate">{recipe.name}</span>
                          <span className="text-sm text-muted-foreground">
                            販売 {formatYen(recipe.sellingPrice)}
                            {hasCost && <> ／ 原価 {formatYen(cost.totalCost)}</>}
                          </span>
                        </div>
                        <div className={`shrink-0 flex flex-col items-end ${style.text}`}>
                          {hasCost ? (
                            <>
                              <span className="font-bold text-lg leading-none">
                                {Math.round(cost.profitRate)}%
                              </span>
                              <span className="text-xs flex items-center gap-1">
                                {style.Icon && <style.Icon className="w-3.5 h-3.5" />}
                                {style.label}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs">{style.label}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
