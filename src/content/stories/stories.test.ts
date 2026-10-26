import { describe, expect, it } from "vitest";
import { adjustmentsUpTo, afterAmount, netIncome, stepSlots, validateStory } from "../../domain/story.ts";
import { TOPICS } from "../topics.ts";
import { STORIES } from "./index.ts";

describe("ストーリーのデータ", () => {
  it("IDに重複がない", () => {
    const ids = STORIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(STORIES.map((s) => [s.id, s] as const))("%s: 金額と選択肢に矛盾がない", (_, s) => {
    expect(TOPICS[s.topicId], s.topicId).toBeDefined();
    expect(validateStory(s)).toEqual([]);
    if (s.table !== "ledger" && s.table !== "inventory") expect(netIncome(s)).toBeGreaterThan(0);
  });

  // 最後のステップの解説に書いた金額（収益・費用・当期純利益）が、計算と一致する
  it.each([
    ["story-ws-1", 1050000, 973000, 77000],
    ["story-tb-1", 1154000, 1118600, 35400],
    ["story-fs-1", 1340000, 1186500, 153500],
    ["story-ws-2", 1583600, 1479000, 104600],
    ["story-tb-2", 1342000, 1176500, 165500],
    ["story-fs-2", 1256000, 1130500, 125500],
  ])("%s: 解説の収益・費用・当期純利益", (id, revenue, expense, net) => {
    const s = STORIES.find((x) => x.id === id)!;
    const adj = adjustmentsUpTo(s, s.steps.length);
    const total = (side: "借" | "貸") => s.accounts.filter((a) => a.pl && a.side === side).reduce((t, a) => t + afterAmount(a, adj), 0);
    expect([total("貸"), total("借"), netIncome(s)]).toEqual([revenue, expense, net]);
  });

  // 商品有高帳：各ステップの正解（解説に書いた金額と一致する）と、入力の順番
  it.each([
    ["story-inv-1", [
      ["16,500", "50", "26,500", "530"],
      ["550", "5,500", "21,000", "525"],
      ["525", "15,750", "10", "5,250"],
      ["525", "1,050", "6,300"],
      ["14,980", "40", "21,280", "532"],
      ["532", "13,300", "7,980"],
      ["42,900", "28,000", "14,900"],
    ]],
    ["story-inv-2", [
      ["12,800", "20", "40"],
      ["20", "10", "3,200", "9,600"],
      ["320", "1,600", "25", "8,000"],
      ["9,900", "25", "30"],
      ["25", "10", "3,300", "6,600"],
      ["33,200", "20,500", "12,700"],
    ]],
  ] as const)("%s: 各ステップの正解", (id, expected) => {
    const s = STORIES.find((x) => x.id === id)!;
    expect(s.steps.map((_, i) => i).concat(s.steps.length).map((i) => stepSlots(s, i).map((x) => x.answer))).toEqual(expected);
  });
});
