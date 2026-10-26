import type { BankEntry } from "../../domain/course.ts";
import type {
  JournalBlankQuestion,
  LedgerAccountQuestion,
  LedgerEntry,
  MultiSelectQuestion,
  Side,
  TableBlankQuestion,
  TableCell,
} from "../../domain/types.ts";

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
  const entry = tb(topicId, id, prompt, "精算表（一部）", WS_COLUMNS, tableRows, [...answers, ...distractors], explanation);
  // 整理後は修正記入から計算するので、修正記入の空欄を先に、整理後の空欄を後に埋める
  const COL_INDEX: Record<WsCol, number> = { tb: 1, dr: 2, cr: 3, after: 4 };
  const key = ([r, c]: [number, WsCol]) => `r${r}c${COL_INDEX[c]}`;
  const sorted = [...blanks].sort(([r1, c1], [r2, c2]) => Number(c1 === "after") - Number(c2 === "after") || r1 - r2 || COL_INDEX[c1] - COL_INDEX[c2]);
  (entry.question as TableBlankQuestion).order = sorted.map(key);
  return entry;
}

/* ---------------------------------------------------------
   商品有高帳の問題
   取引の一覧から、移動平均法・先入先出法で帳簿の全行をヘルパーが計算する。
   問題文は本試験と同じく取引の一覧で示し、空欄は指定したセルだけにする。
   列は「日付・摘要／欄（受入・払出・残高）／数量／単価／金額」。
   本試験の9列（受入・払出・残高 × 数量・単価・金額）はスマホに収まらないため、欄を行に分けている。
--------------------------------------------------------- */

export type InvMethod = "移動平均法" | "先入先出法";
// [日付, 取引, 数量, 単価]。売上の単価は売価（帳簿には原価で記入する）
export type InvTx = [date: string, kind: "前月繰越" | "仕入" | "売上", qty: number, price: number];
export type InvSection = "受入" | "払出" | "残高";
export type InvCol = "q" | "p" | "a";
// [日付, 欄, 列, 同じ欄の何行目か（先入先出法で単価ごとに行が分かれるとき）]
export type InvBlank = [date: string, section: InvSection, col: InvCol, nth?: number];

export const INV_COLUMNS = ["日付・摘要", "欄", "数量", "単価", "金額"];
const INV_COL_INDEX: Record<InvCol, number> = { q: 2, p: 3, a: 4 };

interface InvRow {
  date: string;
  kind: InvTx[1];
  section: InvSection;
  q: number;
  p: number;
  a: number;
}

export function inventoryRows(method: InvMethod, txs: InvTx[]): InvRow[] {
  const rows: InvRow[] = [];
  let lots: { q: number; p: number }[] = [];
  const pushBalance = (date: string, kind: InvTx[1]) => {
    if (method === "移動平均法") {
      const q = lots.reduce((t, l) => t + l.q, 0);
      const a = lots.reduce((t, l) => t + l.q * l.p, 0);
      if (q > 0 && a % q !== 0) throw new Error(`${date}: 平均単価 ${a}÷${q} が割り切れない`);
      const p = q > 0 ? a / q : 0;
      lots = q > 0 ? [{ q, p }] : [];
      rows.push({ date, kind, section: "残高", q, p, a });
    } else {
      for (const l of lots) rows.push({ date, kind, section: "残高", q: l.q, p: l.p, a: l.q * l.p });
    }
  };
  for (const [date, kind, qty, price] of txs) {
    if (kind === "売上") {
      let rest = qty;
      while (rest > 0) {
        const lot = lots[0];
        if (!lot) throw new Error(`${date}: 在庫が足りない`);
        const take = Math.min(rest, lot.q);
        rows.push({ date, kind, section: "払出", q: take, p: lot.p, a: take * lot.p });
        lot.q -= take;
        rest -= take;
        if (lot.q === 0) lots.shift();
      }
    } else {
      rows.push({ date, kind, section: "受入", q: qty, p: price, a: qty * price });
      lots.push({ q: qty, p: price });
    }
    pushBalance(date, kind);
  }
  return rows;
}

// 本試験と同じく「6月8日 仕入 30個 @¥160」の形で書く
const txLine = ([date, kind, qty, price]: InvTx) => {
  const [m, d] = date.split("/");
  return `${m}月${d}日 ${kind} ${qty}個 @¥${yen(price)}${kind === "売上" ? "（売価）" : ""}`;
};

export function il(
  topicId: string,
  id: string,
  method: InvMethod,
  item: string,
  txs: InvTx[],
  blanks: InvBlank[],
  distractors: string[],
  explanation: string,
): BankEntry {
  const rows = inventoryRows(method, txs);
  const blankAt = new Map<string, InvCol[]>();
  for (const [date, section, col, nth = 0] of blanks) {
    const matches = rows.map((r, i) => [r, i] as const).filter(([r]) => r.date === date && r.section === section);
    const hit = matches[nth];
    if (!hit) throw new Error(`${id}: ${date} ${section} の${nth + 1}行目がない`);
    blankAt.set(String(hit[1]), [...(blankAt.get(String(hit[1])) ?? []), col]);
  }

  const answers: string[] = [];
  const order: string[] = [];
  const tableRows: TableCell[][] = rows.map((r, i) => {
    const first = i === 0 || rows[i - 1].date !== r.date || rows[i - 1].kind !== r.kind;
    const cols = blankAt.get(String(i)) ?? [];
    // 移動平均法で仕入れた後の残高は、数量と金額を足してから単価を割り出す
    const seq: InvCol[] = method === "移動平均法" && r.section === "残高" && r.kind === "仕入" ? ["q", "a", "p"] : ["q", "p", "a"];
    for (const c of seq) if (cols.includes(c)) order.push(`r${i}c${INV_COL_INDEX[c]}`);
    const cell = (c: InvCol): TableCell => {
      const v = yen(r[c]) || "0";
      if (!cols.includes(c)) return v;
      answers.push(v);
      return blank(v);
    };
    return [first ? `${r.date} ${r.kind}` : "", r.section, cell("q"), cell("p"), cell("a")];
  });
  if (answers.length !== blanks.length) throw new Error(`${id}: 同じセルを2回空欄に指定している`);
  for (const d of distractors) if (answers.includes(d)) throw new Error(`${id}: ダミーの選択肢 ${d} が正解と重なっている`);

  const prompt = [`次の${item}に関する取引にもとづいて、${method}によって商品有高帳に記入する。`, ...txs.map(txLine)].join("\n");
  const entry = tb(topicId, id, prompt, `商品有高帳（${method}）${item}`, INV_COLUMNS, tableRows, [...answers, ...distractors], explanation);
  (entry.question as TableBlankQuestion).order = order;
  return entry;
}

// 同じ取引の一覧から、当月の売上高・売上原価・売上総利益を求める問題
export function ilSummary(topicId: string, id: string, method: InvMethod, item: string, txs: InvTx[], distractors: string[], explanation: string): BankEntry {
  const sales = txs.filter(([, k]) => k === "売上").reduce((t, [, , q, p]) => t + q * p, 0);
  const cost = inventoryRows(method, txs)
    .filter((r) => r.section === "払出")
    .reduce((t, r) => t + r.a, 0);
  const answers = [yen(sales), yen(cost), yen(sales - cost)];
  for (const d of distractors) if (answers.includes(d)) throw new Error(`${id}: ダミーの選択肢 ${d} が正解と重なっている`);
  const prompt = [`次の${item}に関する取引にもとづいて、${method}によった場合の当月の売上高・売上原価・売上総利益を求める。`, ...txs.map(txLine)].join("\n");
  return tb(topicId, id, prompt, "売上総利益の計算", ["項目", "金額"], [
    ["売上高", blank(answers[0])],
    ["売上原価", blank(answers[1])],
    ["売上総利益", blank(answers[2])],
  ], [...answers, ...distractors], explanation);
}

/* ---------------------------------------------------------
   勘定記入（T勘定）の問題
   借方合計と貸方合計が一致しない勘定は作れない（締め切れないため）。
   blanks は空欄にするセルのキー：d0n（借方1行目の摘要）、c1a（貸方2行目の金額）、t（合計）
--------------------------------------------------------- */

export type LaEntry = [date: string, desc: string, amount: number];

// 勘定記入の入力順。本試験と同じく日付の順に記入し、損益への振替と締切（次期繰越など）、合計は最後にする
const OPENING = ["前期繰越", "前月繰越"];
const CLOSING = ["次期繰越", "次月繰越"];

function ledgerDateRank(date: string): number {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(date);
  if (!m) return 1500; // 「期中」などは期首と期末の間
  const month = Number(m[1]);
  return (month < 4 ? month + 12 : month) * 100 + Number(m[2]);
}

function ledgerEntryRank(account: string, desc: string): number {
  if (OPENING.includes(desc)) return -1;
  if (CLOSING.includes(desc) || (account === "損益" && desc === "繰越利益剰余金")) return 2;
  if (desc === "損益") return 1;
  return 0;
}

export function la(
  topicId: string,
  id: string,
  prompt: string | string[], // 配列なら1行ずつ（冒頭の指示文と、日付付きの取引）
  account: string,
  debit: LaEntry[],
  credit: LaEntry[],
  blanks: string[],
  distractors: string[],
  explanation: string,
): BankEntry {
  const sum = (xs: LaEntry[]) => xs.reduce((t, [, , a]) => t + a, 0);
  if (sum(debit) !== sum(credit)) throw new Error(`${id}: 借方合計 ${sum(debit)} と貸方合計 ${sum(credit)} が一致しない`);

  const answers: string[] = [];
  const cell = (key: string, value: string): TableCell => {
    if (!blanks.includes(key)) return value;
    answers.push(value);
    return blank(value);
  };
  const side = (entries: LaEntry[], s: "d" | "c"): LedgerEntry[] =>
    entries.map(([date, desc, amount], i) => ({ date, desc: cell(`${s}${i}n`, desc), amount: cell(`${s}${i}a`, yen(amount)) }));

  const entries = [...debit.map((e, i) => ["d", i, e] as const), ...credit.map((e, i) => ["c", i, e] as const)];
  const sortKey = ([s, i, [date, desc]]: (typeof entries)[number]) => {
    const r = ledgerEntryRank(account, desc);
    return [r, r > 0 ? 0 : ledgerDateRank(date), s === "d" ? 0 : 1, i];
  };
  const sorted = [...entries].sort((a, b) => {
    const [ka, kb] = [sortKey(a), sortKey(b)];
    return ka.reduce((acc, v, k) => acc || v - kb[k], 0);
  });
  const order = [...sorted.flatMap(([s, i]) => [`${s}${i}n`, `${s}${i}a`]), "t"].filter((k) => blanks.includes(k));

  const question: LedgerAccountQuestion = {
    id,
    format: "ledgerAccount",
    prompt: Array.isArray(prompt) ? prompt.join("\n") : prompt,
    account,
    debit: side(debit, "d"),
    credit: side(credit, "c"),
    total: cell("t", yen(sum(debit))),
    choices: [],
    explanation,
  };
  const unknown = blanks.filter((k) => k !== "t" && !/^[dc]\d+[na]$/.test(k));
  if (unknown.length || answers.length !== blanks.length) throw new Error(`${id}: 空欄のキーが正しくない ${blanks.join(",")}`);
  for (const d of distractors) if (answers.includes(d)) throw new Error(`${id}: ダミーの選択肢 ${d} が正解と重なっている`);
  question.choices = [...answers, ...distractors];
  question.order = order;
  return { topicId, question };
}
