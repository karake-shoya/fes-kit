"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";
import { formatDate } from "@/lib/format";

const VISIBLE_COUNT = 5;

// ダッシュボードに表示する更新履歴。最新5件のみ表示し、「すべて表示」でモーダルから全件見られるようにする。
export function ChangelogSection() {
  const [open, setOpen] = useState(false);
  const visible = CHANGELOG.slice(0, VISIBLE_COUNT);
  const hasMore = CHANGELOG.length > VISIBLE_COUNT;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
        <History className="w-4 h-4 text-primary" /> 更新履歴
      </h2>
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <ChangelogList entries={visible} />

          {hasMore && (
            <Button
              variant="ghost"
              className="text-primary hover:bg-primary/10 -mb-1 self-center"
              onClick={() => setOpen(true)}
            >
              すべて表示
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">更新履歴</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <ChangelogList entries={CHANGELOG} />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatDate(entry.date)}
          </span>
          <span className="text-sm text-foreground leading-relaxed">{entry.title}</span>
        </div>
      ))}
    </div>
  );
}
