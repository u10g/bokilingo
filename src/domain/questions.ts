import type { Answer, JournalAnswer, JournalBlankAnswer, JournalBlankQuestion, Question } from "./types.ts";

/* ---------------------------------------------------------
   問題形式ごとのヘルパー
   採点・入力完了判定・正解文言・初期値の4つが同じ分岐を持つ。
   switch の default で never に代入しているため、
   形式を追加すると分岐漏れが型エラーになる。
--------------------------------------------------------- */

function assertNever(x: never): never {
  throw new Error(`未対応の問題形式: ${JSON.stringify(x)}`);
}

// 出題順を毎回入れ替え、並び順の丸暗記を防ぐ
export function shuffled<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface JournalSlot {
  key: string;
  answer: string;
}

// 空欄になっている側のセルだけを、上の行から順に返す
export function journalSlots(q: JournalBlankQuestion): JournalSlot[] {
  const slots: JournalSlot[] = [];
  q.rows.forEach((r, ri) => {
    if (q.blankSide === "debit" && r.debitAnswer) {
      slots.push({ key: `d${ri}`, answer: r.debitAnswer });
    }
    if (q.blankSide === "credit" && r.creditAnswer) {
      slots.push({ key: `c${ri}`, answer: r.creditAnswer });
    }
  });
  return slots;
}

// 選択肢トークンのID。同じ科目名が複数あっても区別できるよう index を含める
export function tokenId(q: JournalBlankQuestion, index: number): string {
  return `${q.id}::c${index}`;
}

function tokenLabel(q: JournalBlankQuestion, id: string): string | undefined {
  const idx = Number(id.split("::c")[1]);
  return q.choices[idx];
}

export function emptyAnswer(q: Question): Answer {
  switch (q.format) {
    case "journal":
      return { debitAccount: "", debitAmount: "", creditAccount: "", creditAmount: "" };
    case "journalBlank":
      return { slots: {} };
    case "classify":
    case "twochoice":
    case "fillblank":
      return null;
    default:
      return assertNever(q);
  }
}

export function isAnswerReady(q: Question, answer: Answer): boolean {
  switch (q.format) {
    case "journal": {
      const a = answer as JournalAnswer;
      return Boolean(a.debitAccount && a.debitAmount !== "" && a.creditAccount && a.creditAmount !== "");
    }
    case "journalBlank": {
      const a = answer as JournalBlankAnswer;
      return journalSlots(q).every((s) => Boolean(a.slots[s.key]));
    }
    case "classify":
    case "twochoice":
    case "fillblank":
      return answer !== null && answer !== "";
    default:
      return assertNever(q);
  }
}

export function gradeAnswer(q: Question, answer: Answer): boolean {
  switch (q.format) {
    case "journal": {
      const a = answer as JournalAnswer;
      return (
        a.debitAccount === q.debitAccount &&
        Number(a.debitAmount) === q.debitAmount &&
        a.creditAccount === q.creditAccount &&
        Number(a.creditAmount) === q.creditAmount
      );
    }
    case "journalBlank": {
      // 置かれた語のラベルが、そのセルの正解と一致するかを見る
      const a = answer as JournalBlankAnswer;
      return journalSlots(q).every((s) => {
        const id = a.slots[s.key];
        return Boolean(id) && tokenLabel(q, id) === s.answer;
      });
    }
    case "classify":
    case "twochoice":
    case "fillblank":
      return answer === q.answer;
    default:
      return assertNever(q);
  }
}

export function correctAnswerText(q: Question): string {
  switch (q.format) {
    case "journal":
      return `借方) ${q.debitAccount} ${q.debitAmount.toLocaleString()}円 ／ 貸方) ${q.creditAccount} ${q.creditAmount.toLocaleString()}円`;
    case "journalBlank":
      return q.rows
        .map((r) => {
          const d = r.debitAnswer ? `${r.debitAnswer} ${r.debitAmount.toLocaleString()}` : "―";
          const c = r.creditAnswer ? `${r.creditAnswer} ${r.creditAmount.toLocaleString()}` : "―";
          return `${d} ／ ${c}`;
        })
        .join("、");
    case "classify":
    case "twochoice":
    case "fillblank":
      return q.answer;
    default:
      return assertNever(q);
  }
}
