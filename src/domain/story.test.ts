import { describe, expect, it } from "vitest";
import { adjustmentsUpTo, afterAmount, netIncome, NET_KEY, stepChoices, stepSlots, validateStory, visibleAccounts } from "./story.ts";
import type { Story } from "./types.ts";

const story: Story = {
  id: "s",
  topicId: "worksheet",
  table: "worksheet",
  title: "",
  intro: "",
  accounts: [
    { account: "売掛金", side: "借", tb: 1000 },
    { account: "貸倒引当金", side: "貸", tb: 10 },
    { account: "資本金", side: "貸", tb: 790 },
    { account: "売上", side: "貸", tb: 500, pl: true },
    { account: "仕入", side: "借", tb: 300, pl: true },
    { account: "貸倒引当金繰入", side: "借", pl: true },
  ],
  steps: [
    {
      item: "貸倒引当金を設定する",
      entries: [
        { account: "貸倒引当金", cr: 10 },
        { account: "貸倒引当金繰入", dr: 10 },
      ],
      distractors: ["20", "5"],
      explanation: "",
    },
  ],
  finale: { distractors: ["200", "210"], explanation: "" },
};

describe("ストーリーの表", () => {
  it("追加の科目は、使うステップから表に出す", () => {
    expect(visibleAccounts(story, -1).map((a) => a.account)).not.toContain("貸倒引当金繰入");
    expect(visibleAccounts(story, 0).map((a) => a.account)).toContain("貸倒引当金繰入");
  });

  it("整理後は、残高と同じ側の修正を足し、反対側の修正を引く", () => {
    const adj = adjustmentsUpTo(story, 1);
    expect(afterAmount(story.accounts[1], adj)).toBe(20);
    expect(afterAmount(story.accounts[5], adj)).toBe(10);
    expect(afterAmount(story.accounts[1], adjustmentsUpTo(story, 0))).toBe(10);
  });

  it("当期純利益は 収益 − 費用", () => {
    expect(netIncome(story)).toBe(500 - 300 - 10);
  });

  it("空欄と選択肢", () => {
    expect(stepSlots(story, 0).map((s) => [s.key, s.answer])).toEqual([
      ["貸倒引当金:cr", "10"],
      ["貸倒引当金繰入:dr", "10"],
    ]);
    expect(stepChoices(story, 0)).toEqual(["10", "10", "20", "5"]);
    expect(stepSlots(story, 1)).toEqual([{ key: NET_KEY, account: "当期純利益", col: "after", answer: "190" }]);
  });

  it("正しいデータには誤りがない", () => {
    expect(validateStory(story)).toEqual([]);
  });

  it("貸借の不一致・同じマスの再使用・正解と重なるダミーを見つける", () => {
    const bad: Story = {
      ...story,
      steps: [
        { ...story.steps[0], entries: [{ account: "貸倒引当金", cr: 10 }, { account: "貸倒引当金繰入", dr: 9 }], distractors: ["10", "9"] },
        { ...story.steps[0] },
      ],
    };
    const errors = validateStory(bad).join("\n");
    expect(errors).toMatch("一致しない");
    expect(errors).toMatch("2回以上");
    expect(errors).toMatch("ダミー");
  });
});
