"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, CircleCheck } from "lucide-react";

// 画面下から出る短いお知らせ。主に「保存できませんでした」を伝えるために使う。
// 依存を増やさずに済むよう、購読者リストだけの最小構成にしている。
type Tone = "error" | "success";
type Notice = { message: string; tone: Tone };
type Listener = (notice: Notice) => void;
const listeners = new Set<Listener>();

// 表示時間（ms）。読み切れる程度に短く。
const DURATION = 3200;

/**
 * どこからでも呼べる通知。クライアント側でのみ動く。
 * 既定は失敗の通知。うまくいったことを伝えるときだけ tone に "success" を渡す
 * （アイコンが警告のままだと成功が失敗に見えるため）。
 */
export function showToast(message: string, tone: Tone = "error") {
  listeners.forEach((listen) => listen({ message, tone }));
}

/** 通知の表示場所。(app)/layout.tsx に1つだけ置く */
export function Toaster() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const listen: Listener = (next) => setNotice(next);
    listeners.add(listen);
    return () => {
      listeners.delete(listen);
    };
  }, []);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), DURATION);
    return () => clearTimeout(timer);
  }, [notice]);

  if (notice === null) return null;

  const Icon = notice.tone === "success" ? CircleCheck : TriangleAlert;

  return (
    <div
      role="status"
      aria-live="polite"
      // タブバーの上に重ならないよう、safe-area＋タブバー分を持ち上げる。
      // 削除確認モーダル（Radixのポータル・z-50）を開いたまま出ることがあるため、
      // それより上（z-60）に置かないとオーバーレイの下に隠れて見えない。
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-60 flex justify-center px-4 pointer-events-none"
    >
      <div className="flex items-center gap-2 rounded-2xl bg-foreground/90 px-4 py-3 text-sm text-background shadow-lg backdrop-blur">
        <Icon className="w-4 h-4 shrink-0" />
        <span>{notice.message}</span>
      </div>
    </div>
  );
}
