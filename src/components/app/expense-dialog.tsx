"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExpense, updateExpense, deleteExpense } from "@/actions/expense";
import { EntityFormDialog } from "@/components/app/entity-form-dialog";
import { useEntityDialog } from "@/lib/use-entity-dialog";
import type { ProjectExpense } from "@/db/schema";

// 費目入力の候補（datalist）。よくある固定費を先に見せて入力の手間を減らす
const LABEL_OPTIONS = ["出店料", "テントレンタル", "ガスボンベ", "調理器具レンタル", "駐車場代", "看板・装飾"];

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  expense?: ProjectExpense;
  children: React.ReactNode;
};

export function ExpenseDialog({ projectId, expense, children }: Props) {
  const isEdit = Boolean(expense);
  const dialog = useEntityDialog();

  return (
    <EntityFormDialog
      dialog={dialog}
      isEdit={isEdit}
      title={isEdit ? "かかるお金を編集" : "かかるお金を追加"}
      trigger={children}
      onSubmit={async (formData) => {
        if (expense) {
          await updateExpense(expense.id, projectId, formData);
          return;
        }
        await createExpense(projectId, formData);
        return { resetForm: true };
      }}
      onDelete={
        expense && {
          label: "この項目を削除",
          confirmWith: "modal" as const,
          message: <>「{expense.label}」を削除します。<br />この操作は取り消せません。</>,
          run: () => deleteExpense(expense.id, projectId),
        }
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="label">費目 <span className="text-red-500">*</span></Label>
        <Input
          id="label"
          name="label"
          list="expense-label-options"
          placeholder="例：出店料"
          defaultValue={expense?.label ?? ""}
          required
          autoFocus={!isEdit}
        />
        <datalist id="expense-label-options">
          {LABEL_OPTIONS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">金額（円） <span className="text-red-500">*</span></Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="numeric"
          step="1"
          min="1"
          placeholder="5000"
          defaultValue={expense?.amount ?? ""}
          required
        />
        <p className="text-xs text-muted-foreground/70">
          何個売っても変わらない費用を入れます。容器・割り箸のように
          1個ごとにかかるものは「材料」に登録してください。
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memo">メモ</Label>
        <Input
          id="memo"
          name="memo"
          placeholder="例：当日現金払い"
          defaultValue={expense?.memo ?? ""}
        />
      </div>
    </EntityFormDialog>
  );
}
