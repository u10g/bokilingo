import { describe, expect, it } from "vitest";
import { ACCOUNTS } from "../domain/constants.ts";
import { emptyAnswer, gradeAnswer, isAnswerReady, journalSlots, tokenId } from "../domain/questions.ts";
import type { JournalBlankQuestion, Question } from "../domain/types.ts";
import { COURSES } from "./courses.ts";

/* ---------------------------------------------------------
   問題データの検証
   設計書「検証済みの項目」を自動化したもの。問題を追加・修正したら必ず通す。
--------------------------------------------------------- */

const allQuestions: { courseId: string; nodeId: string; q: Question }[] = COURSES.flatMap((c) =>
  c.nodes.flatMap((n) => n.questions.map((q) => ({ courseId: c.id, nodeId: n.id, q }))),
);
const byFormat = <F extends Question["format"]>(f: F) =>
  allQuestions.map((x) => x.q).filter((q): q is Extract<Question, { format: F }> => q.format === f);

const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe("コース構成", () => {
  it("コースIDに重複がない", () => {
    expect(dupes(COURSES.map((c) => c.id))).toEqual([]);
  });

  it("レッスンIDに重複がない", () => {
    expect(dupes(COURSES.flatMap((c) => c.nodes.map((n) => n.id)))).toEqual([]);
  });

  it("問題IDに重複がない", () => {
    expect(dupes(allQuestions.map((x) => x.q.id))).toEqual([]);
  });

  it.each(COURSES.map((c) => [c.id, c] as const))("%s: 全レッスンに問題があり、章が定義されている", (_, c) => {
    for (const n of c.nodes) {
      expect(n.questions.length, n.id).toBeGreaterThan(0);
      expect(c.chapters[n.chapter], `${n.id} の章 ${n.chapter}`).toBeDefined();
    }
  });

  it("同じ章のレッスンは連続して並んでいる（章バナーが二重に出ない）", () => {
    for (const c of COURSES) {
      const order = c.nodes.map((n) => n.chapter).filter((ch, i, arr) => i === 0 || arr[i - 1] !== ch);
      expect(dupes(order), c.id).toEqual([]);
    }
  });
});

describe("5要素分類（classify）", () => {
  it("同じ科目の分類が全コースで一貫している", () => {
    const seen = new Map<string, { answer: string; id: string }>();
    const conflicts: string[] = [];
    for (const q of byFormat("classify")) {
      const prev = seen.get(q.prompt);
      if (prev && prev.answer !== q.answer) conflicts.push(`${q.prompt}: ${prev.id}=${prev.answer} / ${q.id}=${q.answer}`);
      if (!prev) seen.set(q.prompt, { answer: q.answer, id: q.id });
    }
    expect(conflicts).toEqual([]);
  });
});

describe("選択式（twochoice / fillblank）", () => {
  it("正解が選択肢に含まれ、選択肢に重複がない", () => {
    for (const q of [...byFormat("twochoice"), ...byFormat("fillblank")]) {
      expect(q.options, q.id).toContain(q.answer);
      expect(dupes(q.options), q.id).toEqual([]);
    }
  });

  it("穴埋め文に空欄がちょうど1つある", () => {
    for (const q of byFormat("fillblank")) {
      expect(q.prompt.split("［　］").length, q.id).toBe(2);
    }
  });
});

describe("仕訳（journal）", () => {
  it("借方と貸方の金額が一致する", () => {
    for (const q of byFormat("journal")) {
      expect(q.debitAmount, q.id).toBe(q.creditAmount);
    }
  });

  it("正解の科目がプルダウンの選択肢にある", () => {
    for (const q of byFormat("journal")) {
      expect(ACCOUNTS, `${q.id} 借方`).toContain(q.debitAccount);
      expect(ACCOUNTS, `${q.id} 貸方`).toContain(q.creditAccount);
    }
  });
});

describe("仕訳穴埋め（journalBlank）", () => {
  const questions = byFormat("journalBlank");

  const sum = (q: JournalBlankQuestion, side: "debit" | "credit") =>
    q.rows.reduce((s, r) => s + (side === "debit" ? (r.debitAnswer ? r.debitAmount : 0) : r.creditAnswer ? r.creditAmount : 0), 0);

  // 各空欄に正解のトークンを置いた回答を作る
  const correctAnswer = (q: JournalBlankQuestion) => ({
    slots: Object.fromEntries(journalSlots(q).map((s) => [s.key, tokenId(q, q.choices.indexOf(s.answer))])),
  });

  it.each(questions.map((q) => [q.id, q] as const))("%s", (_, q) => {
    // 借方合計と貸方合計が一致する
    expect(sum(q, "debit")).toBe(sum(q, "credit"));

    // 空欄側のセルが1つ以上あり、正解の科目が選択肢に含まれる
    const slots = journalSlots(q);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) expect(q.choices).toContain(s.answer);

    // ヒント側に表示される科目が選択肢に混入していない
    const hints = q.rows.map((r) => (q.blankSide === "debit" ? r.creditAnswer : r.debitAnswer)).filter((x): x is string => Boolean(x));
    for (const h of hints) expect(q.choices, `ヒント側の「${h}」`).not.toContain(h);

    // 選択肢に重複がない
    expect(dupes(q.choices)).toEqual([]);

    // 正解で正解、1箇所誤りで不正解、未入力で未完了と判定される
    const right = correctAnswer(q);
    expect(isAnswerReady(q, right)).toBe(true);
    expect(gradeAnswer(q, right)).toBe(true);

    const wrongIdx = q.choices.findIndex((c) => c !== slots[0].answer);
    const oneWrong = { slots: { ...right.slots, [slots[0].key]: tokenId(q, wrongIdx) } };
    expect(gradeAnswer(q, oneWrong)).toBe(false);

    expect(isAnswerReady(q, emptyAnswer(q))).toBe(false);
  });
});
