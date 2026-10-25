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

export type Question =
  | ClassifyQuestion
  | TwoChoiceQuestion
  | FillBlankQuestion
  | JournalQuestion
  | JournalBlankQuestion;

export type Format = Question["format"];

// 形式ごとの回答の型
export interface JournalAnswer {
  debitAccount: string;
  debitAmount: string;
  creditAccount: string;
  creditAmount: string;
}

export interface JournalBlankAnswer {
  // セルのキー（d0, c1 など）→ 置いたトークンのID
  slots: Record<string, string>;
}

export type Answer = string | null | JournalAnswer | JournalBlankAnswer;

export type NodeKind = "concept" | "training" | "checkpoint";

export interface LessonNode {
  id: string;
  title: string;
  kind: NodeKind;
  chapter: string;
  unit?: string;
  desc: string;
  questions: Question[];
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
