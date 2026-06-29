"use client";

import { createContext, useContext, useState } from "react";
import { isSameMonth, startOfMonth } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

// カレンダーの表示月をヘッダー（今月ボタン）とカレンダー本体で共有するための Context。
// スケジュールページ内のクライアント境界をまたいで状態を一元管理する。
type ScheduleMonthValue = {
  month: Date;
  setMonth: (date: Date) => void;
};

const ScheduleMonthContext = createContext<ScheduleMonthValue | null>(null);

export function ScheduleMonthProvider({
  initialMonth,
  children,
}: {
  // 初期表示月（YYYY-MM-DD など Date 化済みのもの）。未指定なら今月。
  initialMonth?: Date;
  children: React.ReactNode;
}) {
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(initialMonth ?? new Date())
  );

  return (
    <ScheduleMonthContext.Provider value={{ month, setMonth }}>
      {children}
    </ScheduleMonthContext.Provider>
  );
}

export function useScheduleMonth(): ScheduleMonthValue {
  const ctx = useContext(ScheduleMonthContext);
  if (!ctx) {
    throw new Error("useScheduleMonth は ScheduleMonthProvider の内側で使ってください");
  }
  return ctx;
}

// 今月以外を表示しているときだけ現れる「今月へ戻る」ボタン。
export function TodayButton() {
  const { month, setMonth } = useScheduleMonth();
  const today = new Date();

  if (isSameMonth(month, today)) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setMonth(startOfMonth(today))}
      className="border-primary/30 text-primary hover:bg-primary/10"
    >
      <CalendarDays className="w-4 h-4" /> 今月
    </Button>
  );
}
