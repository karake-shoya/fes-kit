"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createProject } from "@/actions/project";

export function CreateProjectDialog() {
  const [open, setOpen]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await createProject(formData);
        setOpen(false);
        formRef.current?.reset();
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-amber-700 hover:bg-amber-800 text-white">
          <Plus className="w-4 h-4" /> 新しいプロジェクトを作る
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[92vw] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">新規プロジェクト</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">プロジェクト名 <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              name="name"
              placeholder="例：文化祭2025 焼きそば屋台"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eventDate">イベント日</Label>
            <Input
              id="eventDate"
              name="eventDate"
              type="date"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">メモ</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="このプロジェクトについて何か書いておきましょう"
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <Button
            type="submit"
            disabled={isPending}
            className="bg-amber-700 hover:bg-amber-800 text-white"
          >
            {isPending ? "作成中…" : "作成する"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
