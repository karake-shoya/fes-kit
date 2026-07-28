"use client";

import { ExpenseDialog } from "@/components/app/expense-dialog";
import { SwipeActionCard } from "@/components/app/swipe-action-card";
import { deleteExpense } from "@/actions/expense";
import { formatYen } from "@/lib/format";
import type { ProjectExpense } from "@/db/schema";

type Props = {
  expense: ProjectExpense;
  projectId: string;
  // editor 以上なら編集ダイアログ・スワイプ削除が使える
  canEdit: boolean;
};

// かかるお金1件分のカード（タップで編集・左スワイプで削除）
export function ExpenseCard({ expense, projectId, canEdit }: Props) {
  const body = (
    <div className="flex flex-1 min-w-0 items-center gap-3">
      <div className="flex flex-col min-w-0 text-left">
        <span className="text-sm font-medium text-foreground truncate">{expense.label}</span>
        {expense.memo && (
          <span className="text-xs text-muted-foreground/70 truncate">{expense.memo}</span>
        )}
      </div>
      <span className="ml-auto shrink-0 text-sm font-semibold text-foreground tabular-nums">
        {formatYen(expense.amount)}
      </span>
    </div>
  );

  return (
    <SwipeActionCard
      enabled={canEdit}
      deleteAriaLabel="この項目を削除"
      confirmMessage={<>「{expense.label}」を削除します。<br />この操作は取り消せません。</>}
      onDelete={() => deleteExpense(expense.id, projectId)}
    >
      <div className="flex flex-1 min-w-0 items-center overflow-hidden rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
        {canEdit ? (
          <ExpenseDialog projectId={projectId} expense={expense}>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center active:scale-[0.99] transition-transform"
            >
              {body}
            </button>
          </ExpenseDialog>
        ) : (
          body
        )}
      </div>
    </SwipeActionCard>
  );
}
