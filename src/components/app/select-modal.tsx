"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SelectOption = {
  id:         string;
  primary:    string;   // 主表示（材料名・レシピ名など）
  secondary?: string;   // 補助表示（単価など）
};

type Props = {
  value:        string;
  onChange:     (id: string) => void;
  options:      SelectOption[];
  placeholder:  string;       // 未選択時のトリガー表示
  title:        string;       // モーダル見出し
  emptyText?:   string;       // 候補ゼロ時の表示
  fallbackLabel?: string;     // value が options に無いときの表示（削除済み等）
};

// ネイティブ <select> の代わりに、別モーダルから一覧をタップして選ぶUI。
// スマホで OS のドロップダウンが勝手に開くのを避け、見てわかりやすくする。
export function SelectModal({
  value,
  onChange,
  options,
  placeholder,
  title,
  emptyText = "選べる項目がありません",
  fallbackLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  // 選択済みの表示テキスト（options に無い場合は fallbackLabel）
  const triggerPrimary   = selected?.primary ?? (value ? fallbackLabel : undefined);
  const triggerSecondary = selected?.secondary;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-auto min-h-9 w-full rounded-md border border-border bg-card px-3 py-2 text-left text-sm flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {triggerPrimary ? (
          <span className="flex flex-col min-w-0">
            <span className="text-foreground truncate">{triggerPrimary}</span>
            {triggerSecondary && (
              <span className="text-xs text-muted-foreground truncate">{triggerSecondary}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground/70">{placeholder}</span>
        )}
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/70" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </DialogHeader>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground/70 text-center py-6">{emptyText}</p>
          ) : (
            <ul className="flex flex-col gap-2 mt-2 max-h-[60vh] overflow-y-auto">
              {options.map((o) => {
                const isSelected = o.id === value;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.id);
                        setOpen(false);
                      }}
                      className={`w-full text-left rounded-xl border px-3 py-3 flex flex-col active:scale-[0.99] transition-transform ${
                        isSelected
                          ? "border-primary/30 bg-primary/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground truncate">{o.primary}</span>
                      {o.secondary && (
                        <span className="text-xs text-muted-foreground truncate">{o.secondary}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
