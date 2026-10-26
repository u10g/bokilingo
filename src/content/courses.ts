import { buildCourse, type CourseDef } from "../domain/course.ts";
import type { Course } from "../domain/types.ts";
import { BANK } from "./bank.ts";
import { TOPICS } from "./topics.ts";

/* ---------------------------------------------------------
   コース一覧
   ① TAC出版の章順、② 本試験の出題頻度順（後半に第2問・第3問）
   どちらも同じ問題バンクを使い、論点の並べ方だけが異なる。
   進捗はコースごとに独立する。先頭のコースを標準コースとして扱う。

   並びの根拠は docs/topic-map.md。
--------------------------------------------------------- */

// TAC出版「簿記の教科書 日商3級」の章順（docs/topic-map.md）。
// 問題がまだない章（01 簿記の基礎、07 帳簿、08 試算表、09 伝票、10・12 決算手続I・III）は、論点を追加したら差し込む
const TAC: CourseDef = {
  id: "tac",
  title: "TAC順コース",
  subtitle: "教科書の章の順番で学ぶ",
  stubNote: "帳簿・試算表・伝票・精算表の章は準備中",
  sections: [
    { id: "s1", title: "CHAPTER 02", subtitle: "商品売買", bg: "bg-emerald-500", sub: "text-emerald-100", topicIds: ["sales-basic", "sales-extra"] },
    { id: "s2", title: "CHAPTER 03", subtitle: "現金預金", bg: "bg-sky-500", sub: "text-sky-100", topicIds: ["cash-deposit", "cash-short"] },
    { id: "s3", title: "CHAPTER 04", subtitle: "手形と電子記録債権（債務）", bg: "bg-indigo-500", sub: "text-indigo-100", topicIds: ["notes"] },
    { id: "s4", title: "CHAPTER 05", subtitle: "有形固定資産", bg: "bg-amber-600", sub: "text-amber-100", topicIds: ["fixed-assets"] },
    { id: "s5", title: "CHAPTER 06 前半", subtitle: "その他の取引（債権債務・仮勘定・給料・賃借）", bg: "bg-violet-500", sub: "text-violet-100", topicIds: ["loans", "suspense", "payroll", "rent"] },
    { id: "s6", title: "CHAPTER 06 後半", subtitle: "その他の取引（収益・費用・消費税・株式）", bg: "bg-orange-500", sub: "text-orange-100", topicIds: ["services", "expenses", "consumption-tax", "equity"] },
    { id: "s7", title: "CHAPTER 11 前半", subtitle: "決算手続II（振替・貸倒れ・減価償却）", bg: "bg-rose-500", sub: "text-rose-100", topicIds: ["closing", "bad-debts", "depreciation"] },
    { id: "s8", title: "CHAPTER 11 後半", subtitle: "決算手続II（経過勘定・法人税等）", bg: "bg-fuchsia-500", sub: "text-fuchsia-100", topicIds: ["accruals", "corporate-tax"] },
  ],
};

// 第1問の出題数（docs/topic-map.md、本試験問題集4回分）の多い論点から並べる。
// 決算系の論点は第1問での出題が少なく、第2問・第3問で必ず問われるため後半に置く
const EXAM: CourseDef = {
  id: "exam",
  title: "本試験頻度順コース",
  subtitle: "第1問の頻出論点から、第2問・第3問へ",
  stubNote: "並び順は本試験問題集4回分の出題数にもとづく（回を追加したら更新）",
  sections: [
    { id: "e1", title: "第1問 頻出 1", subtitle: "商品売買", bg: "bg-emerald-500", sub: "text-emerald-100", topicIds: ["sales-extra", "sales-basic"] },
    { id: "e2", title: "第1問 頻出 2", subtitle: "現金・預金と仮勘定", bg: "bg-sky-500", sub: "text-sky-100", topicIds: ["cash-deposit", "suspense", "cash-short"] },
    { id: "e3", title: "第1問 頻出 3", subtitle: "経費・給料・賃借", bg: "bg-orange-500", sub: "text-orange-100", topicIds: ["expenses", "payroll", "rent", "services"] },
    { id: "e4", title: "第1問 頻出 4", subtitle: "固定資産と債権・債務", bg: "bg-amber-600", sub: "text-amber-100", topicIds: ["fixed-assets", "loans", "notes"] },
    { id: "e5", title: "第1問 頻出 5", subtitle: "税金と株式", bg: "bg-violet-500", sub: "text-violet-100", topicIds: ["consumption-tax", "corporate-tax", "equity"] },
    { id: "e6", title: "第2問・第3問 1", subtitle: "決算の振替と貸倒れ", bg: "bg-rose-500", sub: "text-rose-100", topicIds: ["closing", "bad-debts"] },
    { id: "e7", title: "第2問・第3問 2", subtitle: "減価償却と経過勘定", bg: "bg-slate-600", sub: "text-slate-200", topicIds: ["depreciation", "accruals"] },
  ],
};

export const COURSE_DEFS: CourseDef[] = [TAC, EXAM];

export const COURSES: Course[] = COURSE_DEFS.map((def) => buildCourse(def, TOPICS, BANK));
