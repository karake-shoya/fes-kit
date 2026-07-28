"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSchedule, updateSchedule, deleteSchedule } from "@/actions/schedule";
import { EntityFormDialog } from "@/components/app/entity-form-dialog";
import { useEntityDialog } from "@/lib/use-entity-dialog";
import { STATUS_STYLE, STATUS_ORDER, dateToYmd } from "@/lib/schedule";
import type { Schedule } from "@/db/schema";

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  schedule?: Schedule;
  children: React.ReactNode;
};

export function ScheduleDialog({ projectId, schedule, children }: Props) {
  const isEdit = Boolean(schedule);
  const dialog = useEntityDialog();

  return (
    <EntityFormDialog
      dialog={dialog}
      isEdit={isEdit}
      title={isEdit ? "予定を編集" : "予定を追加"}
      trigger={children}
      onSubmit={async (formData) => {
        if (schedule) {
          await updateSchedule(schedule.id, projectId, formData);
          return;
        }
        await createSchedule(projectId, formData);
        return { resetForm: true };
      }}
      onDelete={
        schedule && {
          label: "この予定を削除",
          confirmWith: "modal" as const,
          message: <>「{schedule.title}」を削除します。<br />この操作は取り消せません。</>,
          run: () => deleteSchedule(schedule.id, projectId),
        }
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">やること <span className="text-red-500">*</span></Label>
        <Input
          id="title"
          name="title"
          placeholder="例：仕込み・買い出し"
          defaultValue={schedule?.title ?? ""}
          required
          autoFocus={!isEdit}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">開始日 <span className="text-red-500">*</span></Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            // 編集時は既存値、追加時は今日を初期表示（手入力の手間を減らす）
            defaultValue={schedule?.startDate ?? dateToYmd(new Date())}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endDate">終了日</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={schedule?.endDate ?? ""}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground/70 -mt-2">
        1日で終わる予定は終了日を空欄でOKです。
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">状態</Label>
        <select
          id="status"
          name="status"
          defaultValue={schedule?.status ?? "todo"}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memo">メモ</Label>
        <Textarea
          id="memo"
          name="memo"
          placeholder="持ち物や担当者など"
          rows={2}
          defaultValue={schedule?.memo ?? ""}
        />
      </div>
    </EntityFormDialog>
  );
}
