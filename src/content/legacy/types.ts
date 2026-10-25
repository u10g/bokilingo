import type { ChapterInfo, Question } from "../../domain/types.ts";

/* ---------------------------------------------------------
   旧コース（モック由来の4コース）の型
   新コースはこれらを問題バンクとして参照する。
--------------------------------------------------------- */

export interface LegacyNode {
  id: string;
  title: string;
  kind: "concept" | "training" | "checkpoint";
  chapter: string;
  desc: string;
  questions: Question[];
}

export interface LegacyCourse {
  id: string;
  title: string;
  chapters: Record<string, ChapterInfo>;
  nodes: LegacyNode[];
}
