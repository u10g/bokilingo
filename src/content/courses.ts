import type { Course } from "../domain/types.ts";
import { ACCOUNTS_CHAPTERS, ACCOUNTS_NODES } from "./accounts.ts";
import { JOURNAL_BLANK_CHAPTERS, JOURNAL_BLANK_NODES } from "./journalBlank.ts";
import { PATTERN_CHAPTERS, PATTERN_NODES } from "./pattern.ts";
import { TAC_CHAPTERS, TAC_NODES } from "./tac.ts";

/* ---------------------------------------------------------
   コース一覧
   先頭のコースを標準コースとして扱う。
   進捗の初期化・復元・リセットはこの一覧から導出する。
--------------------------------------------------------- */

export const COURSES: Course[] = [
  {
    id: "accounts",
    title: "勘定科目コース",
    subtitle: "選択式で勘定科目を一気に覚える",
    chapters: ACCOUNTS_CHAPTERS,
    nodes: ACCOUNTS_NODES,
    stubNote: "手形・固定資産台帳など、関連する勘定科目の追加分・準備中",
  },
  {
    id: "journalBlank",
    title: "仕訳穴埋めコース",
    subtitle: "空欄に勘定科目を入れて仕訳を作る",
    chapters: JOURNAL_BLANK_CHAPTERS,
    nodes: JOURNAL_BLANK_NODES,
    stubNote: "税金・株式会社の仕訳・準備中",
  },
  {
    id: "tac",
    title: "TAC出版準拠コース",
    subtitle: "教科書の章立てで学ぶ",
    chapters: TAC_CHAPTERS,
    nodes: TAC_NODES,
    stubNote: "CHAPTER 03〜13・準備中（手形/固定資産/その他取引/帳簿/試算表/伝票/決算 など）",
  },
  {
    id: "pattern",
    title: "思考パターン別コース",
    subtitle: "仕訳の考え方のパターンで学ぶ",
    chapters: PATTERN_CHAPTERS,
    nodes: PATTERN_NODES,
    stubNote: "見越し・繰延べパターン／資産の振替パターンなど・準備中",
  },
];
