import { describe, expect, it } from "vitest";
import { correctAnswerText } from "./questions.ts";
import type { JournalBlankQuestion } from "./types.ts";

describe("正解の表示", () => {
  it("仕訳穴埋めは、空欄にした側の科目だけを示す", () => {
    const q: JournalBlankQuestion = {
      id: "t",
      format: "journalBlank",
      blankSide: "debit",
      prompt: "",
      explanation: "",
      choices: [],
      rows: [
        { debitAnswer: "備品減価償却累計額", debitAmount: 192000, creditAnswer: "備品", creditAmount: 480000 },
        { debitAnswer: "未収入金", debitAmount: 200000, creditAnswer: null, creditAmount: 0 },
      ],
    };
    expect(correctAnswerText(q)).toBe("借方：備品減価償却累計額、未収入金");
    expect(correctAnswerText({ ...q, blankSide: "credit" })).toBe("貸方：備品");
  });
});
