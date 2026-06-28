"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSchedule, updateSchedule, deleteSchedule } from "@/actions/schedule";
import { DeleteConfirmInline } from "@/components/app/delete-confirm-inline";
import { STATUS_STYLE, STATUS_ORDER } from "@/lib/schedule";
import type { Schedule } from "@/db/schema";

type Props = {
  projectId: string;
  // 指定があれば編集モード、なければ追加モード
  schedule?: Schedule;
  children: React.ReactNode;
};

export function ScheduleDialog({ projectId, schedule, children }: Props) {
  const isEdit = Boolean(schedule);
  const [open, setOpen]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition]      = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setConfirmDelete(false);
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isEdit && schedule) {
          await updateSchedule(schedule.id, projectId, formData);
        } else {
          await createSchedule(projectId, formData);
          formRef.current?.reset();
        }
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  function handleDelete() {
    if (!schedule) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteSchedule(schedule.id, projectId);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[92vw] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? "予定を編集" : "予定を追加"}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">やること <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              name="title"
              placeholder="例：仕込み・買い出し"
              defaultValue={schedule?.title ?? ""}
              required
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="startDate">開始日 <span className="text-red-500">*</span></Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={schedule?.startDate ?? ""}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="endDate">終了日</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={schedule?.endDate ?? ""}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-400 -mt-2">
            1日で終わる予定は終了日を空欄でOKです。
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">状態</Label>
            <select
              id="status"
              name="status"
              defaultValue={schedule?.status ?? "todo"}
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            disabled={isPending}
            className="bg-amber-700 hover:bg-amber-800 text-white"
          >
            {isPending ? "保存中…" : isEdit ? "変更を保存" : "追加する"}
          </Button>

          {isEdit && !confirmDelete && (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirmDelete(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              この予定を削除
            </Button>
          )}

          {isEdit && confirmDelete && (
            <DeleteConfirmInline
              message="この予定を削除しますか？"
              isPending={isPending}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={handleDelete}
            />
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
