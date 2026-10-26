import { describe, expect, it } from "vitest";
import { tableSlots } from "../../domain/questions.ts";
import { ledgerSlots } from "../../domain/questions.ts";
import type { LedgerAccountQuestion, TableBlankQuestion } from "../../domain/types.ts";
import { il, ilSummary, inventoryRows, la, ws, wsAfter, type InvTx } from "./helpers.ts";

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

  it("修正記入の空欄を先に、整理後の空欄を後に埋める", () => {
    const q = ws("t", "x", "", [
      { account: "保険料", side: "借", tb: 36000, cr: 24000 },
      { account: "前払保険料", side: "借", dr: 24000 },
    ], [[0, "after"], [1, "dr"]], ["8,000"], "").question as TableBlankQuestion;
    expect(tableSlots(q).map((x) => x.answer)).toEqual(["24,000", "12,000"]);
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

describe("商品有高帳のヘルパー", () => {
  const TX: InvTx[] = [
    ["5/1", "前月繰越", 10, 100],
    ["5/5", "仕入", 30, 120],
    ["5/9", "売上", 25, 300],
  ];

  it("移動平均法：仕入のたびに平均単価を計算し直し、払出しはその単価で記入する", () => {
    const rows = inventoryRows("移動平均法", TX).map((r) => [r.date, r.section, r.q, r.p, r.a]);
    expect(rows).toEqual([
      ["5/1", "受入", 10, 100, 1000],
      ["5/1", "残高", 10, 100, 1000],
      ["5/5", "受入", 30, 120, 3600],
      ["5/5", "残高", 40, 115, 4600],
      ["5/9", "払出", 25, 115, 2875],
      ["5/9", "残高", 15, 115, 1725],
    ]);
  });

  it("先入先出法：古い単価から払い出し、残高は単価ごとに分ける", () => {
    const rows = inventoryRows("先入先出法", TX).map((r) => [r.date, r.section, r.q, r.p]);
    expect(rows.slice(4)).toEqual([
      ["5/5", "残高", 30, 120],
      ["5/9", "払出", 10, 100],
      ["5/9", "払出", 15, 120],
      ["5/9", "残高", 15, 120],
    ]);
  });

  it("平均単価が割り切れない取引はエラーにする", () => {
    expect(() => inventoryRows("移動平均法", [["5/1", "前月繰越", 3, 100], ["5/2", "仕入", 4, 101]])).toThrow();
  });

  it("移動平均法の仕入後の残高は、数量→金額→単価の順に埋める", () => {
    const q = il("t", "x", "移動平均法", "A", TX, [["5/5", "残高", "p"], ["5/5", "残高", "a"], ["5/5", "残高", "q"], ["5/9", "払出", "a"]], ["1"], "")
      .question as TableBlankQuestion;
    expect(tableSlots(q).map((x) => x.answer)).toEqual(["40", "4,600", "115", "2,875"]);
    expect(q.prompt.split("\n")).toEqual(["移動平均法により、Aの商品有高帳に記入する。", "5/1 前月繰越 10個 @100円", "5/5 仕入 30個 @120円", "5/9 売上 25個 @300円（売価）"]);
  });

  it("存在しない行やダミーの重なりはエラーにする", () => {
    expect(() => il("t", "x", "移動平均法", "A", TX, [["5/9", "払出", "a", 1]], [], "")).toThrow();
    expect(() => il("t", "x", "移動平均法", "A", TX, [["5/9", "払出", "a"]], ["2,875"], "")).toThrow();
  });

  it("売上高は売価、売上原価は払出欄の合計で計算する", () => {
    const q = ilSummary("t", "x", "先入先出法", "A", TX, ["1"], "").question as TableBlankQuestion;
    expect(tableSlots(q).map((x) => x.answer)).toEqual(["7,500", "2,800", "4,700"]);
  });
});
