import { describe, expect, it } from "vitest";
import { tableSlots } from "../../domain/questions.ts";
import { ledgerSlots } from "../../domain/questions.ts";
import type { LedgerAccountQuestion, TableBlankQuestion } from "../../domain/types.ts";
import { la, ws, wsAfter } from "./helpers.ts";

describe("精算表のヘルパー", () => {
  it("整理後は 試算表 ＋ 同じ側の修正 − 反対側の修正", () => {
    expect(wsAfter({ account: "仕入", side: "借", tb: 380000, dr: 40000, cr: 52000 })).toBe(368000);
    expect(wsAfter({ account: "受取家賃", side: "貸", tb: 180000, dr: 15000 })).toBe(165000);
    expect(wsAfter({ account: "未払利息", side: "貸", cr: 6000 })).toBe(6000);
    expect(wsAfter({ account: "仮払消費税", side: "借", tb: 48000, cr: 48000 })).toBe(0);
  });

  it("空欄の正解を計算し、選択肢に入れる", () => {
    const q = ws("t", "x", "", [{ account: "保険料", side: "借", tb: 36000, cr: 24000 }], [[0, "after"]], ["8,000"], "").question as TableBlankQuestion;
    expect(tableSlots(q).map((s) => s.answer)).toEqual(["12,000"]);
    expect(q.choices).toEqual(["12,000", "8,000"]);
    expect(q.rows[0]).toEqual(["保険料", "36,000", "", "24,000", { blank: "12,000" }]);
  });

  it("空のセルを空欄にしたり、ダミーが正解と重なったりしたらエラーにする", () => {
    expect(() => ws("t", "x", "", [{ account: "A", side: "借", tb: 1000 }], [[0, "dr"]], [], "")).toThrow();
    expect(() => ws("t", "x", "", [{ account: "A", side: "借", tb: 1000 }], [[0, "after"]], ["1,000"], "")).toThrow();
  });
});

describe("勘定記入のヘルパー", () => {
  it("指定したキーを空欄にし、合計を計算する", () => {
    const q = la("t", "x", "", "未払利息", [["4/1", "支払利息", 800], ["3/31", "次期繰越", 1000]], [["4/1", "前期繰越", 800], ["3/31", "支払利息", 1000]], ["d1n", "t"], ["損益"], "")
      .question as LedgerAccountQuestion;
    expect(ledgerSlots(q)).toEqual([
      { key: "d1n", answer: "次期繰越" },
      { key: "t", answer: "1,800" },
    ]);
    expect(q.choices).toEqual(["次期繰越", "1,800", "損益"]);
  });

  it("貸借が一致しない勘定や、存在しないキーはエラーにする", () => {
    expect(() => la("t", "x", "", "A", [["4/1", "B", 100]], [["4/1", "C", 90]], [], [], "")).toThrow();
    expect(() => la("t", "x", "", "A", [["4/1", "B", 100]], [["4/1", "C", 100]], ["d5n"], [], "")).toThrow();
    expect(() => la("t", "x", "", "A", [["4/1", "B", 100]], [["4/1", "C", 100]], ["d0n"], ["B"], "")).toThrow();
  });
});
