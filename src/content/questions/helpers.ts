import type { BankEntry } from "../../domain/course.ts";
import type { JournalBlankQuestion, MultiSelectQuestion, Side, TableBlankQuestion, TableCell } from "../../domain/types.ts";

/* ---------------------------------------------------------
   問題を短く書くためのヘルパー
   問題文・数値はすべてオリジナル（参考書の本文は転記しない）。
--------------------------------------------------------- */

// [借方科目, 借方金額, 貸方科目, 貸方金額]。片側が空の行は科目を null、金額を 0 にする
export type Row = [string | null, number, string | null, number];

export function jb(topicId: string, id: string, blankSide: Side, prompt: string, rows: Row[], choices: string[], explanation: string): BankEntry {
  const question: JournalBlankQuestion = {
    id,
    format: "journalBlank",
    blankSide,
    prompt,
    rows: rows.map(([debitAnswer, debitAmount, creditAnswer, creditAmount]) => ({ debitAnswer, debitAmount, creditAnswer, creditAmount })),
    choices,
    explanation,
  };
  return { topicId, question };
}

export function ms(topicId: string, id: string, prompt: string, options: string[], answers: string[], explanation: string): BankEntry {
  const question: MultiSelectQuestion = { id, format: "multiSelect", prompt, options, answers, explanation };
  return { topicId, question };
}

// 空欄にするセル
export const blank = (answer: string): TableCell => ({ blank: answer });

export function tb(
  topicId: string,
  id: string,
  prompt: string,
  caption: string,
  columns: string[],
  rows: TableCell[][],
  choices: string[],
  explanation: string,
): BankEntry {
  const question: TableBlankQuestion = { id, format: "tableBlank", prompt, caption, columns, rows, choices, explanation };
  return { topicId, question };
}

/* ---------------------------------------------------------
   精算表（一部）の問題
   整理後の金額はヘルパーが計算するので、問題を書くときの計算ミスが入らない。
   side は試算表で残高がある側（借方残高なら "借"、貸方残高なら "貸"）。
   整理後 ＝ 試算表 ＋ 同じ側の修正 − 反対側の修正
--------------------------------------------------------- */

export interface WsRow {
  account: string;
  side: "借" | "貸";
  tb?: number; // 残高試算表
  dr?: number; // 修正記入 借方
  cr?: number; // 修正記入 貸方
}

export type WsCol = "tb" | "dr" | "cr" | "after";

export const WS_COLUMNS = ["勘定科目", "試算表", "修正 借方", "修正 貸方", "整理後"];

export const yen = (n: number | undefined) => (n ? n.toLocaleString("en-US") : "");

export function wsAfter(r: WsRow): number {
  const own = r.side === "借" ? (r.dr ?? 0) : (r.cr ?? 0);
  const other = r.side === "借" ? (r.cr ?? 0) : (r.dr ?? 0);
  return (r.tb ?? 0) + own - other;
}

export function ws(
  topicId: string,
  id: string,
  prompt: string,
  rows: WsRow[],
  blanks: [number, WsCol][],
  distractors: string[],
  explanation: string,
): BankEntry {
  const isBlank = (ri: number, col: WsCol) => blanks.some(([r, c]) => r === ri && c === col);
  const answers: string[] = [];
  const tableRows: TableCell[][] = rows.map((r, ri) => {
    const values: Record<WsCol, string> = { tb: yen(r.tb), dr: yen(r.dr), cr: yen(r.cr), after: yen(wsAfter(r)) };
    const cells = (["tb", "dr", "cr", "after"] as WsCol[]).map((col): TableCell => {
      if (!isBlank(ri, col)) return values[col];
      if (!values[col]) throw new Error(`${id}: 空のセルは空欄にできない（${ri}行 ${col}）`);
      answers.push(values[col]);
      return blank(values[col]);
    });
    return [r.account, ...cells];
  });
  for (const d of distractors) if (answers.includes(d)) throw new Error(`${id}: ダミーの選択肢 ${d} が正解と重なっている`);
  return tb(topicId, id, prompt, "精算表（一部）", WS_COLUMNS, tableRows, [...answers, ...distractors], explanation);
}
