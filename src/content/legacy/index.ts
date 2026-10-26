import type { LegacyCourse } from "./types.ts";
import { ACCOUNTS_CHAPTERS, ACCOUNTS_NODES } from "./accounts.ts";
import { JOURNAL_BLANK_CHAPTERS, JOURNAL_BLANK_NODES } from "./journalBlank.ts";
import { PATTERN_CHAPTERS, PATTERN_NODES } from "./pattern.ts";
import { TAC_CHAPTERS, TAC_NODES } from "./tac.ts";

/* ---------------------------------------------------------
   旧コース一覧（モック由来）
   画面には出さず、新コースの問題バンクとして使う。
   勘定科目コースと仕訳穴埋めコースの問題は論点に割り当てて出題する。
   TAC出版準拠・思考パターン別コースの問題（二択・穴埋め・金額入力の仕訳を含む）は
   データとして保管するだけで、当面は出題しない。
--------------------------------------------------------- */

export const LEGACY_COURSES: LegacyCourse[] = [
  {
    id: "accounts",
    title: "勘定科目コース",
    chapters: ACCOUNTS_CHAPTERS,
    nodes: ACCOUNTS_NODES,
  },
  {
    id: "journalBlank",
    title: "仕訳穴埋めコース",
    chapters: JOURNAL_BLANK_CHAPTERS,
    nodes: JOURNAL_BLANK_NODES,
  },
  {
    id: "tac",
    title: "TAC出版準拠コース",
    chapters: TAC_CHAPTERS,
    nodes: TAC_NODES,
  },
  {
    id: "pattern",
    title: "思考パターン別コース",
    chapters: PATTERN_CHAPTERS,
    nodes: PATTERN_NODES,
  },
];
