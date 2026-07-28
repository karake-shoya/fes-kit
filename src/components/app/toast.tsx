"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";

// 画面下から出る短いお知らせ。主に「保存できませんでした」を伝えるために使う。
// 依存を増やさずに済むよう、購読者リストだけの最小構成にしている。
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

// 表示時間（ms）。読み切れる程度に短く。
const DURATION = 3200;

/** どこからでも呼べる通知。クライアント側でのみ動く */
export function showToast(message: string) {
  listeners.forEach((listen) => listen(message));
}

/** 通知の表示場所。(app)/layout.tsx に1つだけ置く */
export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const listen: Listener = (next) => setMessage(next);
    listeners.add(listen);
    return () => {
      listeners.delete(listen);
    };
  }, []);

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(() => setMessage(null), DURATION);
    return () => clearTimeout(timer);
  }, [message]);

  if (message === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // タブバーの上に重ならないよう、safe-area＋タブバー分を持ち上げる
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 pointer-events-none"
    >
      <div className="flex items-center gap-2 rounded-2xl bg-foreground/90 px-4 py-3 text-sm text-background shadow-lg backdrop-blur">
        <TriangleAlert className="w-4 h-4 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}
