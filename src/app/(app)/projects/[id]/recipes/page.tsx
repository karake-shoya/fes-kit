import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requireProjectPage } from "@/lib/auth";
import { getRecipes } from "@/db/queries/recipes";
import { RecipeDialog } from "@/components/app/recipe-dialog";
import { AppHeader } from "@/components/app/app-header";
import { PageMain, EmptyState } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";
import { formatYen, profitStyle } from "@/lib/format";

export default async function RecipesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 権限判定とレシピ取得は独立なので並列実行する
  const [{ canEdit }, list] = await Promise.all([
    requireProjectPage(id),
    getRecipes(id),
  ]);

  return (
    <>
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

      <PageMain>
        {list.length === 0 ? (
          <EmptyState icon={ClipboardList}>
            まだ商品がありません。<br />
            {canEdit
              ? "「追加」ボタンで商品を登録しましょう！"
              : "編集者が商品を登録するとここに表示されます。"}
          </EmptyState>
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
      </PageMain>
    </>
  );
}
