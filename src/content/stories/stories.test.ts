import { describe, expect, it } from "vitest";
import { adjustmentsUpTo, afterAmount, netIncome, validateStory } from "../../domain/story.ts";
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
    expect(netIncome(s)).toBeGreaterThan(0);
  });

  // 最後のステップの解説に書いた金額（収益・費用・当期純利益）が、計算と一致する
  it.each([
    ["story-ws-1", 1050000, 973000, 77000],
    ["story-tb-1", 1154000, 1118600, 35400],
    ["story-fs-1", 1340000, 1186500, 153500],
  ])("%s: 解説の収益・費用・当期純利益", (id, revenue, expense, net) => {
    const s = STORIES.find((x) => x.id === id)!;
    const adj = adjustmentsUpTo(s, s.steps.length);
    const total = (side: "借" | "貸") => s.accounts.filter((a) => a.pl && a.side === side).reduce((t, a) => t + afterAmount(a, adj), 0);
    expect([total("貸"), total("借"), netIncome(s)]).toEqual([revenue, expense, net]);
  });
});
