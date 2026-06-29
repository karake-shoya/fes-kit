"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteProject } from "@/actions/project";

type Props = {
  projectId: string;
};

export function DeleteProjectButton({ projectId }: Props) {
  const [open, setOpen]              = useState(false);
  const [error, setError]            = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteProject(projectId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          プロジェクトを削除する
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[92vw] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-red-600">本当に削除しますか？</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          材料・レシピ・スケジュール・試作記録がすべて削除されます。この操作は元に戻せません。
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "削除中…" : "削除する"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
