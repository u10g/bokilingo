import { describe, expect, it } from "vitest";
import { buildCourse, chunkEvenly, lessonSize, pickReviewQuestions, type BankEntry, type CourseDef } from "./course.ts";
import type { ClassifyQuestion, JournalBlankQuestion, Story } from "./types.ts";

const cq = (id: string): ClassifyQuestion => ({ id, format: "classify", prompt: id, answer: "資産", explanation: "" });
const jq = (id: string): JournalBlankQuestion => ({
  id,
  format: "journalBlank",
  blankSide: "debit",
  prompt: id,
  rows: [{ debitAnswer: "現金", debitAmount: 1, creditAnswer: "売上", creditAmount: 1 }],
  choices: ["現金", "仕入"],
  explanation: "",
});

describe("chunkEvenly", () => {
  it("上限を超えない範囲で均等に分ける", () => {
    expect(chunkEvenly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 10).map((c) => c.length)).toEqual([6, 5]);
    expect(chunkEvenly([1, 2, 3], 10).map((c) => c.length)).toEqual([3]);
    expect(chunkEvenly([], 10)).toEqual([]);
  });
});

describe("buildCourse", () => {
  const topics = { a: { id: "a", title: "論点A", desc: "" }, b: { id: "b", title: "論点B", desc: "" } };
  const bank: BankEntry[] = [
    ...Array.from({ length: 12 }, (_, i) => ({ topicId: "a", question: cq(`a-c${i}`) })),
    ...Array.from({ length: 5 }, (_, i) => ({ topicId: "a", question: jq(`a-j${i}`) })),
    { topicId: "a", question: jq("a-check"), reviewOnly: true },
    { topicId: "b", question: cq("b-c0") },
  ];
  const def: CourseDef = {
    id: "x",
    title: "",
    subtitle: "",
    stubNote: "",
    sections: [{ id: "s1", title: "S1", subtitle: "", bg: "", sub: "", topicIds: ["a", "b"] }],
  };
  const course = buildCourse(def, topics, bank);

  it("小項目ごとに 分類 → 仕訳、最後にセクション復習を並べる", () => {
    expect(course.nodes.map((n) => [n.unit, n.kind, n.questions.length])).toEqual([
      ["論点A", "classify", 6],
      ["論点A", "classify", 6],
      ["論点A", "journal", 5],
      ["論点B", "classify", 1],
      ["まとめ", "review", 19],
    ]);
  });

  it("復習専用の問題は小項目のレッスンに出さない", () => {
    const regular = course.nodes.filter((n) => n.kind !== "review").flatMap((n) => n.questions.map((q) => q.id));
    expect(regular).not.toContain("a-check");
    expect(course.nodes.at(-1)!.questions.map((q) => q.id)).toContain("a-check");
  });

  it("ストーリーは、その論点のレッスンの直後（セクション復習の前）に置く", () => {
    const story: Story = { id: "st", topicId: "a", table: "worksheet", title: "S", intro: "", accounts: [], steps: [], finale: { distractors: [], explanation: "" } };
    const withStory = buildCourse(def, topics, bank, [story]);
    expect(withStory.nodes.map((n) => n.kind)).toEqual(["classify", "classify", "journal", "story", "classify", "review"]);
    const node = withStory.nodes[3];
    expect([node.id, node.unit, lessonSize(node)]).toEqual(["x:story:st", "論点A", 1]);
  });

  it("レッスンIDはコース・論点・形式・番号から決まる", () => {
    expect(course.nodes.map((n) => n.id)).toEqual(["x:a:classify1", "x:a:classify2", "x:a:journal1", "x:b:classify1", "x:s1:review"]);
  });

  it("未定義の論点はエラーにする", () => {
    expect(() => buildCourse({ ...def, sections: [{ ...def.sections[0], topicIds: ["zzz"] }] }, topics, bank)).toThrow();
  });
});

describe("pickReviewQuestions", () => {
  const pool = Array.from({ length: 30 }, (_, i) => cq(`q${i}`));

  it("候補が多いときは指定数だけ選ぶ（重複なし）", () => {
    const got = pickReviewQuestions(pool, {}, 10);
    expect(got).toHaveLength(10);
    expect(new Set(got.map((q) => q.id)).size).toBe(10);
  });

  it("誤答の多い問題を半数まで優先する", () => {
    const misses = { q1: 3, q2: 5, q3: 1, q4: 2, q5: 4, q6: 1, q7: 1 };
    for (let i = 0; i < 20; i++) {
      const ids = pickReviewQuestions(pool, misses, 10).map((q) => q.id);
      for (const top of ["q2", "q5", "q1", "q4"]) expect(ids).toContain(top);
    }
  });

  it("候補が少なければ全部出す", () => {
    expect(pickReviewQuestions(pool.slice(0, 4), {}, 10)).toHaveLength(4);
  });
});
