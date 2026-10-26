import { describe, expect, it } from "vitest";
import { COURSES } from "../content/courses.ts";
import { bumpStreak, daysBetween, findFrontier, heartsFor, restoreProgress, serializeProgress, todayStr } from "./progress.ts";
import type { WrongEntry } from "./types.ts";

const wrong = (key: string): WrongEntry => ({
  key,
  nodeTitle: "t",
  question: { id: key, format: "classify", prompt: "現金", answer: "資産", explanation: "" },
});

describe("日付", () => {
  it("ローカル日付を YYYY-MM-DD で返す", () => {
    expect(todayStr(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("日数差を数える（月またぎ）", () => {
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
  });
});

describe("ストリーク", () => {
  it("同日中は変化しない", () => {
    expect(bumpStreak(4, "2026-10-25", "2026-10-25")).toEqual({ streak: 4, lastActiveDate: "2026-10-25" });
  });
  it("前回が昨日なら+1", () => {
    expect(bumpStreak(4, "2026-10-24", "2026-10-25").streak).toBe(5);
  });
  it("2日以上空いたら1から", () => {
    expect(bumpStreak(4, "2026-10-22", "2026-10-25").streak).toBe(1);
  });
  it("初回は1", () => {
    expect(bumpStreak(0, null, "2026-10-25").streak).toBe(1);
  });
});

describe("ライフ・進行", () => {
  it("ライフは当日の誤答数から導出し、0未満にならない", () => {
    expect(heartsFor([])).toBe(5);
    expect(heartsFor([wrong("a"), wrong("b")])).toBe(3);
    expect(heartsFor(["a", "b", "c", "d", "e", "f"].map(wrong))).toBe(0);
  });

  it("frontier は最初の未完了レッスン", () => {
    const nodes = COURSES[0].nodes.slice(0, 4);
    expect(findFrontier(nodes, new Set([nodes[0].id, nodes[1].id, nodes[3].id]))).toBe(2);
    expect(findFrontier(nodes, new Set(nodes.map((n) => n.id)))).toBe(4);
  });
});

describe("保存と復元", () => {
  const today = "2026-10-25";

  it("保存データがなければ既定値", () => {
    const p = restoreProgress(null, COURSES, today);
    expect(p.activeCourseId).toBe(COURSES[0].id);
    expect(Object.keys(p.completedSets).sort()).toEqual(COURSES.map((c) => c.id).sort());
  });

  it("保存→復元で内容が変わらない", () => {
    const p = restoreProgress(null, COURSES, today);
    p.activeCourseId = COURSES[1].id;
    p.completedSets[COURSES[1].id] = new Set([COURSES[1].nodes[0].id, COURSES[1].nodes[2].id]);
    p.missCounts = { q1: 2 };
    p.solvedCount = 12;
    p.totalXp = 120;
    p.streak = 3;
    p.lastActiveDate = today;
    p.wrongToday = [wrong("x")];
    const json = JSON.parse(JSON.stringify(serializeProgress(p)));
    expect(restoreProgress(json, COURSES, today)).toEqual(p);
  });

  it("日付が変わると誤答リストを破棄し、2日空くとストリークが0になる", () => {
    const p = restoreProgress(
      { streak: 7, lastActiveDate: "2026-10-22", wrongToday: [wrong("x")], wrongTodayDate: "2026-10-22" },
      COURSES,
      today,
    );
    expect(p.wrongToday).toEqual([]);
    expect(p.streak).toBe(0);
  });

  it("存在しないコースIDは標準コースにフォールバックし、存在しないレッスンIDは捨てる", () => {
    const first = COURSES[0].nodes[0].id;
    const p = restoreProgress({ activeCourseId: "removed", completedSets: { [COURSES[0].id]: [first, "removed:lesson"] } }, COURSES, today);
    expect(p.activeCourseId).toBe(COURSES[0].id);
    expect([...p.completedSets[COURSES[0].id]]).toEqual([first]);
  });
});
