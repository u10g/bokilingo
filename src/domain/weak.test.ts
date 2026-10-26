import { describe, expect, it } from "vitest";
import { fromMissCounts, isGraduated, isWeak, missCountsOf, recordAnswer, weakQueue, type QuestionStats } from "./weak.ts";

describe("苦手の記録", () => {
  it("間違えると苦手になり、別々の2日で正解すると卒業する", () => {
    let s: QuestionStats = {};
    s = recordAnswer(s, "q", false, "2026-11-01");
    expect(isWeak(s.q)).toBe(true);
    s = recordAnswer(s, "q", true, "2026-11-01");
    s = recordAnswer(s, "q", true, "2026-11-01"); // 同じ日の2回目は数えない
    expect(s.q.okDays).toBe(1);
    expect(isWeak(s.q)).toBe(true);
    s = recordAnswer(s, "q", true, "2026-11-02");
    expect(isWeak(s.q)).toBe(false);
    expect(isGraduated(s.q)).toBe(true);
  });

  it("途中で間違えると、正解した日数は0からやり直し", () => {
    let s: QuestionStats = {};
    s = recordAnswer(s, "q", false, "2026-11-01");
    s = recordAnswer(s, "q", true, "2026-11-02");
    s = recordAnswer(s, "q", false, "2026-11-03");
    expect(s.q).toEqual({ miss: 2, okDays: 0, lastOk: null, lastMiss: "2026-11-03" });
  });

  it("一度も間違えていない問題の正解は記録しない", () => {
    const s: QuestionStats = {};
    expect(recordAnswer(s, "q", true, "2026-11-01")).toBe(s);
  });
});

describe("苦手の復習キュー", () => {
  const stats: QuestionStats = {
    a: { miss: 1, okDays: 0, lastOk: null, lastMiss: "2026-11-01" },
    b: { miss: 3, okDays: 1, lastOk: "2026-11-02", lastMiss: "2026-10-30" },
    c: { miss: 1, okDays: 0, lastOk: null, lastMiss: "2026-10-28" },
    today: { miss: 1, okDays: 0, lastOk: null, lastMiss: "2026-11-05" },
    okToday: { miss: 2, okDays: 1, lastOk: "2026-11-05", lastMiss: "2026-11-01" },
    done: { miss: 2, okDays: 2, lastOk: "2026-11-04", lastMiss: "2026-11-01" },
  };

  it("誤答の多い順・古い順に並べ、今日間違えた問題・今日正解した問題・卒業した問題は除く", () => {
    expect(weakQueue(stats, "2026-11-05")).toEqual(["b", "c", "a"]);
  });

  it("誤答回数への変換と、旧データの引き継ぎ", () => {
    expect(missCountsOf(stats).b).toBe(3);
    expect(fromMissCounts({ x: 2, y: 0 })).toEqual({ x: { miss: 2, okDays: 0, lastOk: null, lastMiss: null } });
  });
});
