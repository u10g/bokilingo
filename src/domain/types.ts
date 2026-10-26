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
/* ---------------------------------------------------------
   ストーリー（第3問の決算の流れ）
   決算整理事項を1つずつ読み、表の修正記入を埋めていく。
   1つのレッスンで1枚の表を完成させる。
--------------------------------------------------------- */

// 表の行。tb のない行は決算整理で追加される科目で、最初に使うステップから表に出す
export interface StoryAccount {
  account: string;
  side: "借" | "貸"; // 残高が出る側
  tb?: number; // 決算整理前残高試算表の金額
  pl?: boolean; // 損益計算書の科目（収益・費用）
}

// 財務諸表の表示科目の行。勘定科目（accounts）の整理後の金額を合計して表示する。
// 例：前払費用 ＝ 前払保険料 ＋ 前払家賃、売上原価 ＝ 仕入
export interface StoryLine {
  label: string; // 表示科目（ストーリー内で一意）
  display?: string; // 表示名が label と違うとき。例：建物と備品の「減価償却累計額」
  statement: "PL" | "BS";
  accounts: string[]; // 同じ側（借・貸）の科目だけを入れる
  contra?: boolean; // 資産から差し引く科目（貸倒引当金・減価償却累計額）。△を付けて資産の部に出す
  temp?: boolean; // 決算整理で0になって消える仮の科目（仮払金・仮受消費税など）
}

// 修正記入（＝決算整理仕訳）の1行
export interface StoryEntry {
  account: string;
  dr?: number;
  cr?: number;
}

export interface StoryStep {
  item: string; // 決算整理事項（1行）
  entries: StoryEntry[];
  distractors: string[];
  explanation: string;
}

export interface Story {
  id: string;
  topicId: string; // この論点のレッスンの直後に置く
  // 埋めていく表の種類。worksheet は精算表（修正記入を埋める）、
  // adjustedTb は決算整理後残高試算表（影響を受けた科目の整理後の残高を埋める）、
  // statements は財務諸表（金額が変わった表示科目の行を埋める。lines が必要）
  table: "worksheet" | "adjustedTb" | "statements";
  lines?: StoryLine[];
  title: string;
  intro: string;
  accounts: StoryAccount[];
  steps: StoryStep[];
  finale: { distractors: string[]; explanation: string }; // 最後に当期純利益を求める
}

export type NodeKind = "classify" | "journal" | "table" | "story" | "review";

export interface LessonNode {
  id: string;
  title: string;
  kind: NodeKind;
  chapter: string; // セクションID。値が変わった箇所でマップに見出しを差し込む
  unit?: string; // 小項目（論点）名。値が変わった箇所で区切り線を差し込む
  desc: string;
  questions: Question[]; // review は出題候補の全体。挑戦ごとに一部を選んで出す。story は空
  story?: Story; // kind が story のときだけ持つ
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
