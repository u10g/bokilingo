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

  it("精算表ストーリーの当期純利益と、解説の金額が一致する", () => {
    const s = STORIES.find((x) => x.id === "story-ws-1")!;
    const adj = adjustmentsUpTo(s, s.steps.length);
    const total = (side: "借" | "貸") => s.accounts.filter((a) => a.pl && a.side === side).reduce((t, a) => t + afterAmount(a, adj), 0);
    expect([total("貸"), total("借"), netIncome(s)]).toEqual([1050000, 973000, 77000]);
  });
});
