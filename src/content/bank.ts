import type { BankEntry } from "../domain/course.ts";
import { ACCOUNTS_NODES } from "./legacy/accounts.ts";
import { JOURNAL_BLANK_NODES } from "./legacy/journalBlank.ts";
import { TOPICS } from "./topics.ts";

/* ---------------------------------------------------------
   問題バンク
   旧コースのレッスンを論点に割り当てる。
   章末チェックの問題は、セクション復習でだけ出す（reviewOnly）。
   場面ミックスと総合チェックの問題は、各論点と重複するため使わない。
--------------------------------------------------------- */

// 旧レッスンID → 論点ID
const LESSON_TOPIC: Record<string, string> = {
  "ac-a1": "sales-basic",
  "ac-a2": "sales-extra",
  "ac-b1": "cash-deposit",
  "ac-b2": "cash-short",
  "ac-c1": "notes",
  "ac-c2": "loans",
  "ac-d1": "payroll",
  "ac-d2": "suspense",
  "ac-e1": "expenses",
  "ac-e2": "rent",
  "ac-e3": "services",
  "ac-f1": "fixed-assets",
  "ac-f2": "depreciation",
  "ac-g1": "bad-debts",
  "ac-g2": "accruals",
  "ac-g3": "closing",
  "ac-h1": "consumption-tax",
  "ac-h2": "corporate-tax",
  "ac-i1": "equity",
  jb1: "sales-basic",
  jb2: "sales-extra",
  jb3: "cash-deposit",
  jb4: "cash-short",
  jb5: "notes",
  jb6: "loans",
  jb7: "payroll",
  jb8: "suspense",
  jb9: "expenses",
  jb10: "rent",
  jb11: "fixed-assets",
  jb12: "depreciation",
  jb13: "bad-debts",
  jb14: "accruals",
};

// 章末チェック → 出題するセクション復習の論点（章の先頭の論点）
const CHECKPOINT_TOPIC: Record<string, string> = {
  "ac-a-check": "sales-basic",
  "ac-b-check": "cash-deposit",
  "ac-c-check": "notes",
  "ac-d-check": "payroll",
  "ac-e-check": "expenses",
  "ac-f-check": "fixed-assets",
  "ac-g-check": "bad-debts",
  "ac-h-check": "consumption-tax",
  "ac-i-check": "equity",
  "jb-a-check": "sales-basic",
  "jb-b-check": "cash-deposit",
  "jb-c-check": "notes",
  "jb-d-check": "payroll",
  "jb-e-check": "expenses",
  "jb-f-check": "fixed-assets",
  "jb-g-check": "bad-debts",
};

// レッスン単位の割り当てと異なる問題（売上原価と経過勘定が混在していたレッスン）
const QUESTION_TOPIC: Record<string, string> = {
  "jb14-q1": "closing",
  "jb14-q2": "closing",
};

export const UNUSED_LEGACY_LESSONS = ["ac-mix1", "ac-mix2", "ac-check"];

function build(): BankEntry[] {
  const entries: BankEntry[] = [];
  for (const node of [...ACCOUNTS_NODES, ...JOURNAL_BLANK_NODES]) {
    const lessonTopic = LESSON_TOPIC[node.id];
    const checkTopic = CHECKPOINT_TOPIC[node.id];
    if (!lessonTopic && !checkTopic) {
      if (UNUSED_LEGACY_LESSONS.includes(node.id)) continue;
      throw new Error(`論点が割り当てられていない旧レッスン: ${node.id}`);
    }
    for (const q of node.questions) {
      const topicId = QUESTION_TOPIC[q.id] ?? lessonTopic ?? checkTopic;
      if (!TOPICS[topicId]) throw new Error(`未定義の論点 ${topicId}（${q.id}）`);
      entries.push({ topicId, question: q, reviewOnly: Boolean(checkTopic) || undefined });
    }
  }
  return entries;
}

export const BANK: BankEntry[] = build();
