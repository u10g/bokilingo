import { describe, expect, it } from "vitest";
import { adjustmentsUpTo, afterAmount, ledgerClosing, ledgerPostings, netIncome, NET_KEY, stepChoices, stepSlots, validateStory, visibleAccounts } from "./story.ts";
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

  it("決算整理後残高試算表では、動いた科目の整理後の残高が空欄になる", () => {
    const tb: Story = { ...story, table: "adjustedTb", steps: [{ ...story.steps[0], distractors: ["7", "8"] }] };
    expect(stepSlots(tb, 0).map((s) => [s.key, s.answer])).toEqual([
      ["貸倒引当金:after", "20"],
      ["貸倒引当金繰入:after", "10"],
    ]);
    // 同じ科目を別のステップで再び動かしてもよい（精算表では不可）
    const twice: Story = { ...tb, steps: [tb.steps[0], tb.steps[0]] };
    expect(validateStory(twice)).toEqual([]);
    expect(stepSlots(twice, 1).map((s) => s.answer)).toEqual(["30", "20"]);
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

describe("勘定記入のストーリー", () => {
  const ledgerStory: Story = {
    id: "l",
    topicId: "ledger-entry",
    table: "ledger",
    title: "",
    intro: "",
    accounts: [],
    ledger: { account: "繰越利益剰余金", side: "貸", opening: { date: "4/1", desc: "前期繰越", amount: 500 }, closing: { date: "3/31", desc: "次期繰越" } },
    steps: [
      {
        date: "6/25",
        item: "配当",
        entries: [
          { account: "繰越利益剰余金", dr: 220 },
          { account: "未払配当金", cr: 200 },
          { account: "利益準備金", cr: 20 },
        ],
        distractors: ["資本金", "1"],
        explanation: "",
      },
      { item: "関係しない取引", entries: [{ account: "現金", dr: 10 }, { account: "売上", cr: 10 }], distractors: [], explanation: "" },
      { date: "3/31", item: "当期純利益", entries: [{ account: "損益", dr: 180 }, { account: "繰越利益剰余金", cr: 180 }], distractors: ["売上", "2"], explanation: "" },
    ],
    finale: { distractors: ["3", "4"], explanation: "" },
  };

  it("相手科目が複数なら、相手科目ごとに行を分けて転記する", () => {
    expect(ledgerPostings(ledgerStory, 0).map((p) => [p.side, p.desc, p.amount])).toEqual([
      ["dr", "未払配当金", 200],
      ["dr", "利益準備金", 20],
    ]);
  });

  it("勘定の側に他の科目もあり、相手科目が1つなら、勘定の金額で相手科目を書く", () => {
    const sale: Story = {
      ...ledgerStory,
      ledger: { account: "減価償却累計額", side: "貸", closing: { date: "3/31", desc: "次期繰越" } },
      steps: [{ date: "4/1", item: "", entries: [{ account: "減価償却累計額", dr: 120 }, { account: "未収入金", dr: 80 }, { account: "備品", cr: 200 }], distractors: [], explanation: "" }],
    };
    expect(ledgerPostings(sale, 0).map((p) => [p.desc, p.amount])).toEqual([["備品", 120]]);
  });

  it("勘定に関係しない取引には空欄がない", () => {
    expect(stepSlots(ledgerStory, 1)).toEqual([]);
  });

  it("締切は残高と反対側に記入し、合計を求める", () => {
    expect(ledgerClosing(ledgerStory)).toEqual({ side: "dr", amount: 460, total: 680 });
    expect(stepSlots(ledgerStory, 3).map((s) => s.answer)).toEqual(["460", "680"]);
    expect(validateStory(ledgerStory)).toEqual([]);
  });
});
