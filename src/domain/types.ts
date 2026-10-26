/* ---------------------------------------------------------
   問題・レッスン・コースの型
   問題形式は format で判別する。形式を追加したら、
   domain/questions.ts と components/QuestionRenderer.tsx の
   switch が網羅チェックで型エラーになるので、そこを埋める。
--------------------------------------------------------- */

export type Element = "資産" | "負債" | "純資産" | "収益" | "費用";

interface QuestionBase {
  id: string;
  prompt: string;
  explanation: string;
}

export interface ClassifyQuestion extends QuestionBase {
  format: "classify";
  answer: Element;
}

export interface TwoChoiceQuestion extends QuestionBase {
  format: "twochoice";
  options: [string, string];
  answer: string;
}

export interface FillBlankQuestion extends QuestionBase {
  format: "fillblank";
  options: string[];
  answer: string;
}

export interface JournalQuestion extends QuestionBase {
  format: "journal";
  debitAccount: string;
  debitAmount: number;
  creditAccount: string;
  creditAmount: number;
}

export type Side = "debit" | "credit";

export interface JournalRow {
  debitAnswer: string | null;
  debitAmount: number;
  creditAnswer: string | null;
  creditAmount: number;
}

export interface JournalBlankQuestion extends QuestionBase {
  format: "journalBlank";
  blankSide: Side;
  rows: JournalRow[];
  choices: string[];
}

// 複数選択。例：取引が記入される補助簿をすべて選ぶ
export interface MultiSelectQuestion extends QuestionBase {
  format: "multiSelect";
  options: string[];
  answers: string[]; // 正解（1つ以上）
}

// 表の空欄に語群から語・数値を入れる。例：商品有高帳、財務諸表
export type TableCell = string | { blank: string };

export interface TableBlankQuestion extends QuestionBase {
  format: "tableBlank";
  caption: string; // 表の見出し（「商品有高帳（移動平均法）」など）
  columns: string[];
  rows: TableCell[][];
  choices: string[];
}

// 勘定記入（T勘定）。摘要や金額の空欄を語群から埋める。第2問の勘定記入用
export interface LedgerEntry {
  date: string;
  desc: TableCell; // 摘要（相手科目・前期繰越・次期繰越・損益 など）
  amount: TableCell;
}

export interface LedgerAccountQuestion extends QuestionBase {
  format: "ledgerAccount";
  account: string; // 勘定科目名（T勘定の見出し）
  debit: LedgerEntry[];
  credit: LedgerEntry[];
  total?: TableCell; // 締め切ったときの合計（借方・貸方で同額）
  choices: string[];
}

export type Question =
  | ClassifyQuestion
  | TwoChoiceQuestion
  | FillBlankQuestion
  | JournalQuestion
  | JournalBlankQuestion
  | MultiSelectQuestion
  | TableBlankQuestion
  | LedgerAccountQuestion;

export type Format = Question["format"];

// 形式ごとの回答の型
export interface JournalAnswer {
  debitAccount: string;
  debitAmount: string;
  creditAccount: string;
  creditAmount: string;
}

// 仕訳穴埋め・表の穴埋め・勘定記入で共通の回答
export interface JournalBlankAnswer {
  // セルのキー（d0, c1, r2c3 など）→ 置いたトークンのID
  slots: Record<string, string>;
}

export type Answer = string | null | string[] | JournalAnswer | JournalBlankAnswer;

// classify: 5要素分類 / journal: 仕訳穴埋め / table: 帳簿・表（複数選択・表の穴埋め）
// review: セクション復習（合格判定あり）
export type NodeKind = "classify" | "journal" | "table" | "review";

export interface LessonNode {
  id: string;
  title: string;
  kind: NodeKind;
  chapter: string; // セクションID。値が変わった箇所でマップに見出しを差し込む
  unit?: string; // 小項目（論点）名。値が変わった箇所で区切り線を差し込む
  desc: string;
  questions: Question[]; // review は出題候補の全体。挑戦ごとに一部を選んで出す
}

export interface ChapterInfo {
  title: string;
  subtitle: string;
  bg: string;
  sub: string;
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  chapters: Record<string, ChapterInfo>;
  nodes: LessonNode[];
  stubNote: string;
}

export interface WrongEntry {
  key: string;
  nodeTitle: string;
  question: Question;
}

export interface LessonResult {
  total: number;
  missed: number;
}
