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

  it("日付の順に埋め、損益への振替・締切・合計は最後にする", () => {
    const q = la(
      "t",
      "x",
      ["指示", "4/1 …", "10/1 …"],
      "受取家賃",
      [["3/31", "前受家賃", 180], ["3/31", "損益", 210]],
      [["4/1", "前受家賃", 30], ["10/1", "普通預金", 360]],
      ["t", "d1a", "d0a", "c1n", "c0n"],
      ["次期繰越"],
      "",
    ).question as LedgerAccountQuestion;
    expect(ledgerSlots(q).map((s) => s.key)).toEqual(["c0n", "c1n", "d0a", "d1a", "t"]);
    expect(q.prompt).toBe("指示\n4/1 …\n10/1 …");
  });

  it("前期繰越は最初、次期繰越は損益への振替より後", () => {
    const q = la(
      "t",
      "x",
      "",
      "繰越利益剰余金",
      [["6/25", "未払配当金", 100], ["3/31", "次期繰越", 450]],
      [["4/1", "前期繰越", 500], ["3/31", "損益", 50]],
      ["d1n", "c1n", "d0n", "c0n"],
      [],
      "",
    ).question as LedgerAccountQuestion;
    expect(ledgerSlots(q).map((s) => s.key)).toEqual(["c0n", "d0n", "c1n", "d1n"]);
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
    expect(q.prompt.split("\n")).toEqual(["次のAに関する取引にもとづいて、移動平均法によって商品有高帳に記入する。", "5月1日 前月繰越 10個 @¥100", "5月5日 仕入 30個 @¥120", "5月9日 売上 25個 @¥300（売価）"]);
  });

  it("存在しない行やダミーの重なりはエラーにする", () => {
    expect(() => il("t", "x", "移動平均法", "A", TX, [["5/9", "払出", "a", 1]], [], "")).toThrow();
    expect(() => il("t", "x", "移動平均法", "A", TX, [["5/9", "払出", "a"]], ["2,875"], "")).toThrow();
  });

  // 返品（数値はテスト用）
  const RET: InvTx[] = [
    ["7/1", "前月繰越", 20, 300],
    ["7/5", "仕入", 30, 350],
    ["7/7", "仕入戻し", 10, "7/5"],
    ["7/15", "売上", 30, 500],
    ["7/18", "売上戻り", 5, "7/15"],
  ];

  it("移動平均法：仕入戻しは払出欄に仕入単価で、売上戻りは受入欄に払出単価で記入し、平均単価を計算し直す", () => {
    const rows = inventoryRows("移動平均法", RET).map((r) => [r.date, r.section, r.q, r.p, r.a]);
    expect(rows.slice(4)).toEqual([
      ["7/7", "払出", 10, 350, 3500],
      ["7/7", "残高", 40, 325, 13000],
      ["7/15", "払出", 30, 325, 9750],
      ["7/15", "残高", 10, 325, 3250],
      ["7/18", "受入", 5, 325, 1625],
      ["7/18", "残高", 15, 325, 4875],
    ]);
  });

  it("先入先出法：仕入戻しは、その単価の在庫から減らす。売上戻りは扱わない", () => {
    const rows = inventoryRows("先入先出法", RET.slice(0, 3)).map((r) => [r.date, r.section, r.q, r.p]);
    expect(rows.slice(-3)).toEqual([
      ["7/7", "払出", 10, 350],
      ["7/7", "残高", 20, 300],
      ["7/7", "残高", 20, 350],
    ]);
    expect(() => inventoryRows("先入先出法", RET)).toThrow();
  });

  it("返品があるときは、記入する欄を「なお、」で指示し、元の取引を添える", () => {
    const q = il("t", "x", "移動平均法", "A", RET, [["7/7", "残高", "p"], ["7/7", "残高", "a"]], ["1"], "").question as TableBlankQuestion;
    expect(tableSlots(q).map((x) => x.answer)).toEqual(["13,000", "325"]);
    expect(q.prompt.split("\n").slice(1, 2)).toEqual(["なお、仕入戻しは払出欄に、売上戻りは受入欄に記入する。"]);
    expect(q.prompt).toContain("7月7日 仕入戻し 10個（7月5日仕入分）");
    expect(q.prompt).toContain("7月18日 売上戻り 5個（7月15日売上分）");
  });

  it("売上戻りは、売上高から売価で、売上原価から原価で差し引く", () => {
    const q = ilSummary("t", "x", "移動平均法", "A", RET, ["1"], "").question as TableBlankQuestion;
    // 売上高 30×500−5×500＝12,500、売上原価 9,750−1,625＝8,125
    expect(tableSlots(q).map((x) => x.answer)).toEqual(["12,500", "8,125", "4,375"]);
  });

  it("売上高は売価、売上原価は払出欄の合計で計算する", () => {
    const q = ilSummary("t", "x", "先入先出法", "A", TX, ["1"], "").question as TableBlankQuestion;
    expect(tableSlots(q).map((x) => x.answer)).toEqual(["7,500", "2,800", "4,700"]);
  });
});
