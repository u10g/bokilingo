import { buildCourse, type CourseDef } from "../domain/course.ts";
import type { Course } from "../domain/types.ts";
import { BANK } from "./bank.ts";
import { TOPICS } from "./topics.ts";

/* ---------------------------------------------------------
   コース一覧
   ① TAC出版の章順、② 本試験の出題頻度順（後半に第2問・第3問）
   どちらも同じ問題バンクを使い、論点の並べ方だけが異なる。
   進捗はコースごとに独立する。先頭のコースを標準コースとして扱う。

   並び順は暫定。参考書の分析（docs/topic-map.md）ができたら差し替える。
--------------------------------------------------------- */

const TAC: CourseDef = {
  id: "tac",
  title: "TAC順コース",
  subtitle: "教科書の章の順番で学ぶ",
  stubNote: "章の並びは暫定です（参考書の分析後に確定）",
  sections: [
    { id: "s1", title: "SECTION 1", subtitle: "商品売買", bg: "bg-emerald-500", sub: "text-emerald-100", topicIds: ["sales-basic", "sales-extra"] },
    { id: "s2", title: "SECTION 2", subtitle: "現金と預金", bg: "bg-sky-500", sub: "text-sky-100", topicIds: ["cash-deposit", "cash-short"] },
    { id: "s3", title: "SECTION 3", subtitle: "債権と債務", bg: "bg-indigo-500", sub: "text-indigo-100", topicIds: ["notes", "loans"] },
    { id: "s4", title: "SECTION 4", subtitle: "従業員と仮勘定", bg: "bg-violet-500", sub: "text-violet-100", topicIds: ["payroll", "suspense"] },
    { id: "s5", title: "SECTION 5", subtitle: "経費と賃借", bg: "bg-orange-500", sub: "text-orange-100", topicIds: ["expenses", "rent", "services"] },
    { id: "s6", title: "SECTION 6", subtitle: "固定資産", bg: "bg-amber-600", sub: "text-amber-100", topicIds: ["fixed-assets", "depreciation"] },
    { id: "s7", title: "SECTION 7", subtitle: "株式会社と税金", bg: "bg-fuchsia-500", sub: "text-fuchsia-100", topicIds: ["equity", "consumption-tax", "corporate-tax"] },
    { id: "s8", title: "SECTION 8", subtitle: "決算", bg: "bg-rose-500", sub: "text-rose-100", topicIds: ["bad-debts", "accruals", "closing"] },
  ],
};

const EXAM: CourseDef = {
  id: "exam",
  title: "本試験頻度順コース",
  subtitle: "第1問の頻出論点から、第2問・第3問へ",
  stubNote: "頻度の並びは暫定です（本試験の分析後に確定）",
  sections: [
    { id: "e1", title: "第1問 頻出 1", subtitle: "商品売買", bg: "bg-emerald-500", sub: "text-emerald-100", topicIds: ["sales-basic", "sales-extra"] },
    { id: "e2", title: "第1問 頻出 2", subtitle: "固定資産と株式", bg: "bg-amber-600", sub: "text-amber-100", topicIds: ["fixed-assets", "equity"] },
    { id: "e3", title: "第1問 頻出 3", subtitle: "債権と債務", bg: "bg-indigo-500", sub: "text-indigo-100", topicIds: ["notes", "loans"] },
    { id: "e4", title: "第1問 頻出 4", subtitle: "現金・預金と仮勘定", bg: "bg-sky-500", sub: "text-sky-100", topicIds: ["cash-deposit", "cash-short", "suspense"] },
    { id: "e5", title: "第1問 頻出 5", subtitle: "給料と税金", bg: "bg-violet-500", sub: "text-violet-100", topicIds: ["payroll", "consumption-tax", "corporate-tax"] },
    { id: "e6", title: "第1問 頻出 6", subtitle: "経費と賃借", bg: "bg-orange-500", sub: "text-orange-100", topicIds: ["expenses", "rent", "services"] },
    { id: "e7", title: "第2問・第3問 1", subtitle: "決算整理（償却と引当）", bg: "bg-rose-500", sub: "text-rose-100", topicIds: ["depreciation", "bad-debts"] },
    { id: "e8", title: "第2問・第3問 2", subtitle: "決算整理（経過勘定と売上原価）", bg: "bg-slate-600", sub: "text-slate-200", topicIds: ["accruals", "closing"] },
  ],
};

export const COURSE_DEFS: CourseDef[] = [TAC, EXAM];

export const COURSES: Course[] = COURSE_DEFS.map((def) => buildCourse(def, TOPICS, BANK));
