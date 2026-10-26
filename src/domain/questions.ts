import type {
  Answer,
  JournalAnswer,
  JournalBlankAnswer,
  JournalBlankQuestion,
  LedgerAccountQuestion,
  Question,
  TableBlankQuestion,
  TableCell,
} from "./types.ts";

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

// 表の空欄を、上の行・左の列から順に返す
export function tableSlots(q: TableBlankQuestion): JournalSlot[] {
  const slots: JournalSlot[] = [];
  q.rows.forEach((row, ri) =>
    row.forEach((cell, ci) => {
      if (typeof cell !== "string") slots.push({ key: `r${ri}c${ci}`, answer: cell.blank });
    }),
  );
  return slots;
}

// 勘定記入の空欄を、借方（上から）→ 貸方（上から）→ 合計 の順に返す。
// キーは d0n（借方1行目の摘要）、c1a（貸方2行目の金額）、t（合計）
export function ledgerSlots(q: LedgerAccountQuestion): JournalSlot[] {
  const slots: JournalSlot[] = [];
  const push = (key: string, cell: TableCell | undefined) => {
    if (cell !== undefined && typeof cell !== "string") slots.push({ key, answer: cell.blank });
  };
  (["debit", "credit"] as const).forEach((side) =>
    q[side].forEach((e, i) => {
      push(`${side[0]}${i}n`, e.desc);
      push(`${side[0]}${i}a`, e.amount);
    }),
  );
  push("t", q.total);
  return slots;
}

// 単語バンク方式（語群から空欄に入れる）の形式の空欄
function bankSlots(q: JournalBlankQuestion | TableBlankQuestion | LedgerAccountQuestion): JournalSlot[] {
  if (q.format === "journalBlank") return journalSlots(q);
  if (q.format === "tableBlank") return tableSlots(q);
  return ledgerSlots(q);
}

type WithChoices = { id: string; choices: string[] };

// 選択肢トークンのID。同じ語が複数あっても区別できるよう index を含める
export function tokenId(q: WithChoices, index: number): string {
  return `${q.id}::c${index}`;
}

function tokenLabel(q: WithChoices, id: string): string | undefined {
  const idx = Number(id.split("::c")[1]);
  return q.choices[idx];
}

export function emptyAnswer(q: Question): Answer {
  switch (q.format) {
    case "journal":
      return { debitAccount: "", debitAmount: "", creditAccount: "", creditAmount: "" };
    case "journalBlank":
    case "tableBlank":
    case "ledgerAccount":
      return { slots: {} };
    case "multiSelect":
      return [];
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
    case "journalBlank":
    case "tableBlank":
    case "ledgerAccount": {
      const a = answer as JournalBlankAnswer;
      return bankSlots(q).every((s) => Boolean(a.slots[s.key]));
    }
    case "multiSelect":
      return (answer as string[]).length > 0;
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
    case "journalBlank":
    case "tableBlank":
    case "ledgerAccount": {
      // 置かれた語のラベルが、そのセルの正解と一致するかを見る
      const a = answer as JournalBlankAnswer;
      return bankSlots(q).every((s) => {
        const id = a.slots[s.key];
        return Boolean(id) && tokenLabel(q, id) === s.answer;
      });
    }
    case "multiSelect": {
      const picked = new Set(answer as string[]);
      return picked.size === q.answers.length && q.answers.every((x) => picked.has(x));
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
    case "tableBlank":
    case "ledgerAccount":
      return bankSlots(q)
        .map((s) => s.answer)
        .join("、");
    case "multiSelect":
      return q.answers.join("・");
    case "classify":
    case "twochoice":
    case "fillblank":
      return q.answer;
    default:
      return assertNever(q);
  }
}
