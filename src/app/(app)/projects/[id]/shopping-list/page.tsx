import { ShoppingBasket } from "lucide-react";
import { requireProjectPage } from "@/lib/auth";
import { getShoppingList } from "@/db/queries/shopping-list";
import { AppHeader } from "@/components/app/app-header";
import { formatYen } from "@/lib/format";
import { round1 } from "@/lib/recipe-cost";

export default async function ShoppingListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [, { items, totalCost }] = await Promise.all([
    requireProjectPage(id),
    getShoppingList(id),
  ]);

  return (
    <>
      <AppHeader title="買い出しリスト" backHref={`/projects/${id}`} />

      <main className="px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBasket className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              レシピに材料の使用量を登録すると、<br />
              必要な買い出し量がここに表示されます。
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-4 flex items-center justify-between shadow-sm">
              <span className="text-sm text-foreground">買い出し合計目安</span>
              <span className="text-2xl font-bold text-primary tabular-nums">
                {formatYen(totalCost)}
              </span>
            </section>

            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.ingredientId}>
                  <div className="bg-card rounded-2xl border border-border px-4 py-4 shadow-sm flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-foreground truncate">{item.name}</span>
                      <span className="shrink-0 font-bold text-foreground tabular-nums">
                        {formatYen(item.cost)}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {round1(item.neededQuantity)}{item.unit} 必要
                    </span>
                    <span className="text-xs text-muted-foreground/70">
                      {item.quantityPerUnit}{item.unit}／{formatYen(item.pricePerUnit)} を {item.lotsNeeded}個 購入
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
