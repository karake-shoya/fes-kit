import { describe, expect, it } from "vitest";
import {
  countSchedulesByDay,
  eachDateInRange,
  formatDateRange,
  formatDayHeading,
  groupSchedulesByDay,
  groupSchedulesByStatus,
  isValidYmd,
  nextStatus,
} from "@/lib/schedule";
import type { Schedule } from "@/db/schema";

// タスクのテスト用ファクトリ
function task(over: Partial<Schedule> = {}): Schedule {
  return {
    id:        "s-1",
    projectId: "p-1",
    title:     "買い出し",
    startDate: "2026-07-09",
    endDate:   "2026-07-09",
    status:    "todo",
    memo:      null,
    createdAt: "2026-07-01 00:00:00",
    updatedAt: "2026-07-01 00:00:00",
    ...over,
  };
}

describe("isValidYmd", () => {
  it("YYYY-MM-DD 形式の実在する日付だけを通す", () => {
    expect(isValidYmd("2026-07-09")).toBe(true);
    expect(isValidYmd("2026-02-30")).toBe(false); // 存在しない日
    expect(isValidYmd("2026/07/09")).toBe(false); // 区切りが違う
    expect(isValidYmd("2026-7-9")).toBe(false);   // ゼロ埋めなし
    expect(isValidYmd("")).toBe(false);
  });
});

describe("nextStatus", () => {
  it("未着手 → 進行中 → 完了 → 未着手 と循環する", () => {
    expect(nextStatus("todo")).toBe("in_progress");
    expect(nextStatus("in_progress")).toBe("done");
    expect(nextStatus("done")).toBe("todo");
  });
});

describe("eachDateInRange", () => {
  it("期間を日付の配列に展開する", () => {
    expect(eachDateInRange("2026-07-09", "2026-07-11")).toEqual([
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
    ]);
  });

  it("1日タスクは1件だけ返す", () => {
    expect(eachDateInRange("2026-07-09", "2026-07-09")).toEqual(["2026-07-09"]);
  });

  it("終了日が開始日より前・不正な日付なら開始日だけを返す（防御）", () => {
    expect(eachDateInRange("2026-07-09", "2026-07-01")).toEqual(["2026-07-09"]);
    expect(eachDateInRange("2026-07-09", "こわれた日付")).toEqual(["2026-07-09"]);
  });
});

describe("formatDateRange / formatDayHeading", () => {
  it("1日なら M/d、期間なら M/d〜M/d で表示する", () => {
    expect(formatDateRange("2026-07-09", "2026-07-09")).toBe("7/9");
    expect(formatDateRange("2026-07-09", "2026-07-13")).toBe("7/9〜7/13");
  });

  it("見出しは日本語の曜日付きで表示する", () => {
    expect(formatDayHeading("2026-07-09")).toBe("7月9日(木)");
  });
});

describe("groupSchedulesByDay", () => {
  it("開始日でまとめ、グループ内は 未着手→進行中→完了 の順に並べる", () => {
    const groups = groupSchedulesByDay([
      task({ id: "a", startDate: "2026-07-09", status: "done" }),
      task({ id: "b", startDate: "2026-07-09", status: "todo" }),
      task({ id: "c", startDate: "2026-07-10", status: "in_progress" }),
    ]);

    expect(groups.map(([day]) => day)).toEqual(["2026-07-09", "2026-07-10"]);
    expect(groups[0][1].map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("同じステータス同士は元の並び（id昇順）を保つ", () => {
    const groups = groupSchedulesByDay([
      task({ id: "a", status: "todo" }),
      task({ id: "b", status: "todo" }),
      task({ id: "c", status: "todo" }),
    ]);
    expect(groups[0][1].map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("countSchedulesByDay", () => {
  it("開始日ごとの件数を数える", () => {
    const counts = countSchedulesByDay([
      task({ id: "a", startDate: "2026-07-09" }),
      task({ id: "b", startDate: "2026-07-09" }),
      task({ id: "c", startDate: "2026-07-10" }),
    ]);
    expect(counts.get("2026-07-09")).toBe(2);
    expect(counts.get("2026-07-10")).toBe(1);
    expect(counts.get("2026-07-11")).toBeUndefined();
  });
});

describe("groupSchedulesByStatus", () => {
  it("STATUS_ORDER の順に返し、0件のステータスは含めない", () => {
    const groups = groupSchedulesByStatus([
      task({ id: "a", status: "done" }),
      task({ id: "b", status: "todo" }),
    ]);
    expect(groups.map(([status]) => status)).toEqual(["todo", "done"]);
    expect(groups[0][1].map((s) => s.id)).toEqual(["b"]);
  });
});
