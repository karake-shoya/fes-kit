import Link from "next/link";
import { Plus, Wallet, ChevronRight, Calculator } from "lucide-react";
import { requireProjectPage } from "@/lib/auth";
import { getProjectExpenses } from "@/db/queries/expenses";
import { ExpenseDialog } from "@/components/app/expense-dialog";
import { ExpenseCard } from "@/components/app/expense-card";
import { AppHeader } from "@/components/app/app-header";
import { PageMain, EmptyState } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";
import { sumExpenses } from "@/lib/breakeven";
import { formatYen } from "@/lib/format";

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ canEdit }, expenses] = await Promise.all([
    requireProjectPage(id),
    getProjectExpenses(id),
  ]);

  const total = sumExpenses(expenses);

  return (
    <>
      <AppHeader
        title="かかるお金"
        backHref={`/projects/${id}`}
        action={
          canEdit && (
            <ExpenseDialog projectId={id}>
              <Button size="sm">
                <Plus className="w-4 h-4" /> 追加
              </Button>
            </ExpenseDialog>
          )
        }
      />

      <PageMain gap={4}>
        {expenses.length === 0 ? (
          <EmptyState icon={Wallet}>
            出店料やレンタル代など、
            <br />
            何個売っても変わらない費用を登録します。
            <br />
            {canEdit
              ? "登録すると「何個売ればトントンか」が計算できます！"
              : "編集者が登録するとここに表示されます。"}
          </EmptyState>
        ) : (
          <>
            {/* 合計（この金額を売上から回収する必要がある） */}
            <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-4 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">かかるお金 合計</span>
                <span className="text-xs text-muted-foreground/70">
                  売上からこの金額を回収できて黒字
                </span>
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {formatYen(total)}
              </span>
            </section>

            <ul className="flex flex-col gap-2">
              {expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  projectId={id}
                  canEdit={canEdit}
                />
              ))}
            </ul>

            {/* 登録した固定費を使う先への導線 */}
            <Link
              href={`/projects/${id}/simulation`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10">
                <Calculator className="w-4.5 h-4.5 text-primary" />
              </span>
              <span className="text-sm font-medium text-foreground">
                何個売ればトントンか見る
              </span>
              <ChevronRight className="ml-auto w-5 h-5 text-muted-foreground/40" />
            </Link>
          </>
        )}

        {canEdit && expenses.length > 0 && (
          <p className="text-xs text-muted-foreground px-1">
            容器・割り箸のように1個ごとにかかるものは「材料」に登録すると、
            商品の原価に含めて計算されます。
          </p>
        )}
      </PageMain>
    </>
  );
}
