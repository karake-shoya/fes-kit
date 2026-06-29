import { notFound } from "next/navigation";
import { Settings } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getRecipeWithCost } from "@/db/queries/recipes";
import { getIngredients } from "@/db/queries/ingredients";
import { getMyRole } from "@/db/queries/projects";
import { RecipeDialog } from "@/components/app/recipe-dialog";
import { RecipeProfitPanel } from "@/components/app/recipe-profit-panel";
import { AppHeader } from "@/components/app/app-header";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string; recipeId: string }>;
}) {
  const { id, recipeId } = await params;
  const userId = await requireAuth();

  const [myRole, data, allIngredients] = await Promise.all([
    getMyRole(id, userId),
    getRecipeWithCost(recipeId, id),
    getIngredients(id),
  ]);

  if (!myRole) notFound();
  if (!data) notFound();

  const { recipe, cost } = data;
  const canEdit = myRole === "owner" || myRole === "editor";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={recipe.name}
        backHref={`/projects/${id}/recipes`}
        action={
          canEdit && (
            <RecipeDialog projectId={id} recipe={recipe}>
              <button
                type="button"
                aria-label="レシピ設定"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings className="w-5 h-5" />
              </button>
            </RecipeDialog>
          )
        }
      />

      <main className="px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
        <RecipeProfitPanel
          recipe={{ id: recipe.id, sellingPrice: recipe.sellingPrice, servings: recipe.servings }}
          projectId={id}
          initialLines={cost.lines}
          allIngredients={allIngredients}
          canEdit={canEdit}
        />

        {recipe.memo && (
          <section className="bg-card rounded-2xl border border-border px-4 py-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{recipe.memo}</p>
          </section>
        )}
      </main>
    </div>
  );
}
