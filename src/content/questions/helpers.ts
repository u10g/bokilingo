import type { BankEntry } from "../../domain/course.ts";
import type {
  FillBlankQuestion,
  JournalBlankQuestion,
  LedgerAccountQuestion,
  LedgerEntry,
  MultiSelectQuestion,
  Side,
  TableBlankQuestion,
  TableCell,
  TwoChoiceQuestion,
} from "../../domain/types.ts";
import { cellOrder, inventoryRows, inventorySummary, returnNote, txLine, type InvCol, type InvMethod, type InvSection, type InvTx } from "../../domain/inventory.ts";

export { inventoryRows, type InvMethod, type InvTx } from "../../domain/inventory.ts";

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

// 選択穴埋め：prompt の空欄（全角の角かっこ）に入るものを options から1つ選ぶ。正解は options の先頭に書き、表示の順番は画面で入れ替える
export function fb(topicId: string, id: string, prompt: string, options: string[], explanation: string): BankEntry {
  const question: FillBlankQuestion = { id, format: "fillblank", prompt, options, answer: options[0], explanation };
  return { topicId, question };
}

// 二択：正解を先に書く
export function tc(topicId: string, id: string, prompt: string, options: [string, string], explanation: string): BankEntry {
  const question: TwoChoiceQuestion = { id, format: "twochoice", prompt, options, answer: options[0], explanation };
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
   帳簿の全行は domain/inventory.ts で計算する。
   問題文は本試験と同じく取引の一覧で示し、空欄は指定したセルだけにする。
--------------------------------------------------------- */

// [日付, 欄, 列, 同じ欄の何行目か（先入先出法で単価ごとに行が分かれるとき）]
export type InvBlank = [date: string, section: InvSection, col: InvCol, nth?: number];

export const INV_COLUMNS = ["日付・摘要", "欄", "数量", "単価", "金額"];
const INV_COL_INDEX: Record<InvCol, number> = { q: 2, p: 3, a: 4 };

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
    for (const c of cellOrder(method, r)) if (cols.includes(c)) order.push(`r${i}c${INV_COL_INDEX[c]}`);
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

  const prompt = [`次の${item}に関する取引にもとづいて、${method}によって商品有高帳に記入する。`, ...returnNote(txs), ...txs.map(txLine)].join("\n");
  const entry = tb(topicId, id, prompt, `商品有高帳（${method}）${item}`, INV_COLUMNS, tableRows, [...answers, ...distractors], explanation);
  (entry.question as TableBlankQuestion).order = order;
  return entry;
}

// 同じ取引の一覧から、当月の売上高・売上原価・売上総利益を求める問題
export function ilSummary(topicId: string, id: string, method: InvMethod, item: string, txs: InvTx[], distractors: string[], explanation: string): BankEntry {
  const { sales, cost } = inventorySummary(method, txs);
  const answers = [yen(sales), yen(cost), yen(sales - cost)];
  for (const d of distractors) if (answers.includes(d)) throw new Error(`${id}: ダミーの選択肢 ${d} が正解と重なっている`);
  const prompt = [`次の${item}に関する取引にもとづいて、${method}によった場合の当月の売上高・売上原価・売上総利益を求める。`, ...returnNote(txs), ...txs.map(txLine)].join("\n");
  return tb(topicId, id, prompt, "売上総利益の計算", ["項目", "金額"], [
    ["売上高", blank(answers[0])],
    ["売上原価", blank(answers[1])],
    ["売上総利益", blank(answers[2])],
  ], [...answers, ...distractors], explanation);
}

/* ---------------------------------------------------------
   固定資産台帳の問題
   減価償却は残存価額ゼロの定額法、期中に取得したものは月割。金額はヘルパーが計算する。
   本試験の台帳（取得年月日・名称・耐用年数・取得原価・期首減価償却累計額・当期減価償却費・期末帳簿価額）は
   スマホに収まらないため、行と列を入れ替えて資産ごとに1列にする。
--------------------------------------------------------- */

export interface FaAsset {
  name: string;
  acquired: [year: number, month: number]; // ×年・月（1日に取得）
  life: number; // 耐用年数
  cost: number; // 取得原価
}
// 期首減価償却累計額・当期減価償却費・期末帳簿価額
export type FaField = "acc" | "dep" | "book";
export type FaBlank = [asset: number, field: FaField];

const FA_ROWS = ["取得年月日", "耐用年数", "取得原価", "期首減価償却累計額", "当期減価償却費", "期末帳簿価額"] as const;
const FA_FIELD_ROW: Record<FaField, number> = { acc: 3, dep: 4, book: 5 };

// 会計期間の月の通し番号（4月始まり）。×5年4月 → 5*12+0、×6年3月 → 5*12+11
const fiscalMonth = (year: number, month: number) => (month >= 4 ? year * 12 + (month - 4) : (year - 1) * 12 + (month + 8));

// period は当期の期首の年（×5年4月1日〜×6年3月31日なら 5）
export function faValues(period: number, a: FaAsset): Record<FaField, number> {
  if (a.cost % a.life !== 0) throw new Error(`${a.name}: 1年分の減価償却費 ${a.cost}÷${a.life} が割り切れない`);
  const annual = a.cost / a.life;
  const start = period * 12; // 当期の期首（4月）
  const got = fiscalMonth(...a.acquired);
  if (got > start + 11) throw new Error(`${a.name}: 当期より後に取得している`);
  const before = Math.max(0, start - got); // 期首までに使った月数
  const during = Math.min(12, start + 12 - Math.max(got, start)); // 当期に使った月数
  if ((annual * before) % 12 !== 0 || (annual * during) % 12 !== 0) throw new Error(`${a.name}: 月割の金額が割り切れない`);
  const acc = (annual * before) / 12;
  const dep = (annual * during) / 12;
  if (acc + dep > a.cost) throw new Error(`${a.name}: 耐用年数を過ぎている`);
  return { acc, dep, book: a.cost - acc - dep };
}

export function far(
  topicId: string,
  id: string,
  period: number,
  assets: FaAsset[],
  blanks: FaBlank[],
  distractors: string[],
  explanation: string,
): BankEntry {
  const values = assets.map((a) => faValues(period, a));
  const isBlank = (ai: number, f: FaField) => blanks.some(([i, g]) => i === ai && g === f);
  const answers: string[] = [];
  const rows: TableCell[][] = FA_ROWS.map((label, ri) => [
    label,
    ...assets.map((a, ai): TableCell => {
      if (ri === 0) return `×${a.acquired[0]}年${a.acquired[1]}月1日`;
      if (ri === 1) return `${a.life}年`;
      if (ri === 2) return yen(a.cost);
      const f = (Object.keys(FA_FIELD_ROW) as FaField[]).find((k) => FA_FIELD_ROW[k] === ri)!;
      const v = yen(values[ai][f]) || "0";
      if (!isBlank(ai, f)) return v;
      return blank(v);
    }),
  ]);
  // 入力の順番：資産ごとに、期首累計額 → 当期の償却費 → 期末帳簿価額（帳簿価額は前の2つから求める）
  const order = [...blanks]
    .sort(([a1, f1], [a2, f2]) => a1 - a2 || FA_FIELD_ROW[f1] - FA_FIELD_ROW[f2])
    .map(([ai, f]) => {
      answers.push(yen(values[ai][f]) || "0");
      return `r${FA_FIELD_ROW[f]}c${ai + 1}`;
    });
  for (const d of distractors) if (answers.includes(d)) throw new Error(`${id}: ダミーの選択肢 ${d} が正解と重なっている`);
  const prompt = [
    `当社（決算年1回 3月31日）の当期（×${period}年4月1日〜×${period + 1}年3月31日）の固定資産台帳は、次のとおりである。空欄にあてはまる金額を答える。`,
    "なお、減価償却は残存価額ゼロの定額法により行い、期中に取得したものは月割で計算する。",
  ].join("\n");
  const entry = tb(topicId, id, prompt, `固定資産台帳（×${period + 1}年3月31日）`, ["", ...assets.map((a) => a.name)], rows, [...answers, ...distractors], explanation);
  (entry.question as TableBlankQuestion).order = order;
  return entry;
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
  opts: { open?: boolean } = {}, // open: 締め切る前の途中の勘定（合計欄を出さず、貸借の一致も求めない）
): BankEntry {
  const sum = (xs: LaEntry[]) => xs.reduce((t, [, , a]) => t + a, 0);
  if (!opts.open && sum(debit) !== sum(credit)) throw new Error(`${id}: 借方合計 ${sum(debit)} と貸方合計 ${sum(credit)} が一致しない`);
  if (opts.open && blanks.includes("t")) throw new Error(`${id}: 締め切る前の勘定に合計の空欄は置けない`);

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
    total: opts.open ? undefined : cell("t", yen(sum(debit))),
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
