import { shuffled } from "./questions.ts";
import type { Course, LessonNode, Question } from "./types.ts";

/* ---------------------------------------------------------
   コース構造
   問題は論点（topic）に属し、コースは論点をセクションに並べるだけを持つ。
   これにより、TAC順と頻度順の2コースで同じ問題を共有する。

   セクション内のレッスンは自動で組み立てる。
     小項目（論点）ごとに 5要素分類 ×n → 仕訳穴埋め ×n → 帳簿・表 ×n（ある論点のみ）
     → セクション復習（正答率70%以上で合格）
--------------------------------------------------------- */

export interface TopicDef {
  id: string;
  title: string;
  desc: string;
}

export interface SectionDef {
  id: string;
  title: string; // 「SECTION 1」など
  subtitle: string; // セクション名
  bg: string;
  sub: string;
  topicIds: string[];
}

export interface CourseDef {
  id: string;
  title: string;
  subtitle: string;
  stubNote: string;
  sections: SectionDef[];
}

export interface BankEntry {
  topicId: string;
  question: Question;
  reviewOnly?: boolean; // 小項目のレッスンには出さず、セクション復習でだけ出す
}

export const CLASSIFY_LESSON_MAX = 10;
export const JOURNAL_LESSON_MAX = 8; // 仕訳は1問の負荷が高いため少なめ
export const TABLE_LESSON_MAX = 6; // 帳簿・表はさらに負荷が高い
export const REVIEW_SIZE = 10;

// 上限を超えない範囲で、なるべく均等な塊に分ける（11問 → 6問と5問）
export function chunkEvenly<T>(xs: readonly T[], max: number): T[][] {
  if (xs.length === 0) return [];
  const n = Math.ceil(xs.length / max);
  const size = Math.ceil(xs.length / n);
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

const NUMBERS = "①②③④⑤⑥⑦⑧⑨⑩";

const LESSON_DESC = {
  classify: "勘定科目が5要素のどれかを答えます。",
  journal: "仕訳の空欄に勘定科目を入れます。",
  table: "帳簿や表の空欄を埋めたり、当てはまるものを選んだりします。",
};

function lessonsForTopic(courseId: string, sectionId: string, topic: TopicDef, entries: BankEntry[]): LessonNode[] {
  const regular = entries.filter((e) => !e.reviewOnly).map((e) => e.question);
  const groups: { kind: "classify" | "journal" | "table"; label: string; max: number; qs: Question[] }[] = [
    { kind: "classify", label: "分類", max: CLASSIFY_LESSON_MAX, qs: regular.filter((q) => q.format === "classify") },
    { kind: "journal", label: "仕訳", max: JOURNAL_LESSON_MAX, qs: regular.filter((q) => q.format === "journalBlank") },
    {
      kind: "table",
      label: "帳簿・表",
      max: TABLE_LESSON_MAX,
      qs: regular.filter((q) => q.format === "multiSelect" || q.format === "tableBlank" || q.format === "ledgerAccount"),
    },
  ];
  return groups.flatMap((g) => {
    const chunks = chunkEvenly(g.qs, g.max);
    return chunks.map((qs, i) => ({
      id: `${courseId}:${topic.id}:${g.kind}${i + 1}`,
      title: chunks.length > 1 ? `${g.label}${NUMBERS[i] ?? i + 1}` : g.label,
      kind: g.kind,
      chapter: sectionId,
      unit: topic.title,
      desc: `${topic.desc} ${LESSON_DESC[g.kind]}`,
      questions: qs,
    }));
  });
}

export function buildCourse(def: CourseDef, topics: Record<string, TopicDef>, bank: BankEntry[]): Course {
  const byTopic = new Map<string, BankEntry[]>();
  for (const e of bank) {
    const list = byTopic.get(e.topicId) ?? [];
    list.push(e);
    byTopic.set(e.topicId, list);
  }

  const nodes: LessonNode[] = [];
  for (const s of def.sections) {
    for (const tid of s.topicIds) {
      const topic = topics[tid];
      if (!topic) throw new Error(`${def.id}: 未定義の論点 ${tid}`);
      nodes.push(...lessonsForTopic(def.id, s.id, topic, byTopic.get(tid) ?? []));
    }
    // セクション復習の出題候補は、セクション内の全問（復習専用の問題を含む）
    const pool = s.topicIds.flatMap((tid) => (byTopic.get(tid) ?? []).map((e) => e.question));
    if (pool.length > 0) {
      nodes.push({
        id: `${def.id}:${s.id}:review`,
        title: "セクション復習",
        kind: "review",
        chapter: s.id,
        unit: "まとめ",
        desc: `${s.subtitle}の総まとめです。${REVIEW_SIZE}問のうち正答率70%以上で合格です。`,
        questions: pool,
      });
    }
  }

  return {
    id: def.id,
    title: def.title,
    subtitle: def.subtitle,
    stubNote: def.stubNote,
    chapters: Object.fromEntries(def.sections.map((s) => [s.id, { title: s.title, subtitle: s.subtitle, bg: s.bg, sub: s.sub }])),
    nodes,
  };
}

/* ---------------------------------------------------------
   セクション復習の出題
   過去に間違えた回数が多い問題を優先して半分まで入れ、残りはランダムに選ぶ。
--------------------------------------------------------- */

export function pickReviewQuestions(pool: readonly Question[], missCounts: Record<string, number>, size = REVIEW_SIZE): Question[] {
  if (pool.length <= size) return shuffled(pool);
  const missed = shuffled(pool.filter((q) => (missCounts[q.id] ?? 0) > 0)).sort(
    (a, b) => (missCounts[b.id] ?? 0) - (missCounts[a.id] ?? 0),
  );
  const prioritized = missed.slice(0, Math.floor(size / 2));
  const chosen = new Set(prioritized.map((q) => q.id));
  const rest = shuffled(pool.filter((q) => !chosen.has(q.id))).slice(0, size - prioritized.length);
  return shuffled([...prioritized, ...rest]);
}
