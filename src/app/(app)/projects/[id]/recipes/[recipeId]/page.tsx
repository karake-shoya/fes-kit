import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getRecipeWithCost } from "@/db/queries/recipes";
import { getIngredients } from "@/db/queries/ingredients";
import { getMyRole } from "@/db/queries/projects";
import { RecipeDialog } from "@/components/app/recipe-dialog";
import { RecipeProfitPanel } from "@/components/app/recipe-profit-panel";

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
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-4 flex items-center gap-3">
        <Link href={`/projects/${id}/recipes`} className="text-zinc-400 hover:text-zinc-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-zinc-800 truncate">{recipe.name}</h1>
        {canEdit && (
          <div className="ml-auto">
            <RecipeDialog projectId={id} recipe={recipe}>
              <button type="button" className="text-zinc-400 hover:text-zinc-600"><Settings className="w-5 h-5" /></button>
            </RecipeDialog>
          </div>
        )}
      </header>

      <main className="px-4 py-6 flex flex-col gap-6 max-w-lg mx-auto">
        <RecipeProfitPanel
          recipe={{ id: recipe.id, sellingPrice: recipe.sellingPrice, servings: recipe.servings }}
          projectId={id}
          initialLines={cost.lines}
          allIngredients={allIngredients}
          canEdit={canEdit}
        />

        {recipe.memo && (
          <section className="bg-white rounded-2xl border border-zinc-200 px-4 py-3">
            <p className="text-sm text-zinc-600 whitespace-pre-wrap">{recipe.memo}</p>
          </section>
        )}
      </main>
    </div>
  );
}
