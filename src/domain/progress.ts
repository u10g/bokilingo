import { MAX_HEARTS } from "./constants.ts";
import type { Course, LessonNode, WrongEntry } from "./types.ts";

/* ---------------------------------------------------------
   進捗の状態と、保存・復元・日付まわりのルール
   画面に依存しない純粋関数だけを置き、テストで直接検証する。
--------------------------------------------------------- */

// コースID → クリア済みレッスンID。
// レッスンは問題数から自動で組み立てるため、配列のindexではなくIDで持つ
export type CompletedSets = Record<string, Set<string>>;

export interface ProgressSnapshot {
  activeCourseId: string;
  completedSets: CompletedSets;
  solvedCount: number; // 累計クリア問題数
  totalXp: number;
  streak: number;
  lastActiveDate: string | null; // ストリーク判定の基準日
  wrongToday: WrongEntry[];
  wrongTodayDate: string; // 日付が変われば誤答リストを破棄
  missCounts: Record<string, number>; // 問題ID → これまでの誤答回数。セクション復習の出題に使う
}

// 保存形式。Set は配列に変換して保存する
export interface SavedProgress {
  activeCourseId?: string;
  completedSets?: Record<string, string[]>;
  solvedCount?: number;
  totalXp?: number;
  streak?: number;
  lastActiveDate?: string | null;
  wrongToday?: WrongEntry[];
  wrongTodayDate?: string;
  missCounts?: Record<string, number>;
}

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function emptyCompletedSets(courses: Course[]): CompletedSets {
  return Object.fromEntries(courses.map((c) => [c.id, new Set<string>()]));
}

export function initialProgress(courses: Course[], today: string): ProgressSnapshot {
  return {
    activeCourseId: courses[0].id,
    completedSets: emptyCompletedSets(courses),
    solvedCount: 0,
    totalXp: 0,
    streak: 0,
    lastActiveDate: null,
    wrongToday: [],
    wrongTodayDate: today,
    missCounts: {},
  };
}

export function serializeProgress(p: ProgressSnapshot): SavedProgress {
  return {
    activeCourseId: p.activeCourseId,
    completedSets: Object.fromEntries(Object.entries(p.completedSets).map(([id, set]) => [id, Array.from(set)])),
    solvedCount: p.solvedCount,
    totalXp: p.totalXp,
    streak: p.streak,
    lastActiveDate: p.lastActiveDate,
    wrongToday: p.wrongToday,
    wrongTodayDate: p.wrongTodayDate,
    missCounts: p.missCounts,
  };
}

export function restoreProgress(data: SavedProgress | null, courses: Course[], today: string): ProgressSnapshot {
  const base = initialProgress(courses, today);
  if (!data) return base;

  // 現在のコース一覧にあるコース・レッスンだけ復元する
  const completedSets = emptyCompletedSets(courses);
  for (const c of courses) {
    const ids = new Set(c.nodes.map((n) => n.id));
    const saved = data.completedSets?.[c.id] ?? [];
    completedSets[c.id] = new Set(saved.filter((id) => typeof id === "string" && ids.has(id)));
  }

  let streak = data.streak ?? 0;
  if (data.lastActiveDate && daysBetween(data.lastActiveDate, today) >= 2) {
    streak = 0; // 2日以上あいたら連続記録は途切れる
  }

  const wrongToday = data.wrongTodayDate === today ? (data.wrongToday ?? []) : [];

  // 保存後にコース構成が変わっている場合に備え、存在するIDだけ採用する
  const activeCourseId = courses.some((c) => c.id === data.activeCourseId) ? data.activeCourseId! : base.activeCourseId;

  return {
    activeCourseId,
    completedSets,
    solvedCount: data.solvedCount ?? 0,
    totalXp: data.totalXp ?? 0,
    streak,
    lastActiveDate: data.lastActiveDate ?? null,
    wrongToday,
    wrongTodayDate: today,
    missCounts: data.missCounts ?? {},
  };
}

// 今日はじめての学習かどうかを判定し、連続記録を更新した結果を返す
export function bumpStreak(
  streak: number,
  lastActiveDate: string | null,
  today: string,
): { streak: number; lastActiveDate: string } {
  if (lastActiveDate === today) return { streak, lastActiveDate };
  const next = lastActiveDate && daysBetween(lastActiveDate, today) === 1 ? streak + 1 : 1;
  return { streak: next, lastActiveDate: today };
}

// ライフは当日の誤答数から導出する
export function heartsFor(wrongToday: WrongEntry[]): number {
  return Math.max(0, MAX_HEARTS - wrongToday.length);
}

// 最初の未完了レッスンのindex。すべて完了ならレッスン数を返す
export function findFrontier(nodes: LessonNode[], completed: Set<string>): number {
  const i = nodes.findIndex((n) => !completed.has(n.id));
  return i < 0 ? nodes.length : i;
}

export type NodeState = "completed" | "current" | "locked";

export function getNodeState(nodes: LessonNode[], index: number, completed: Set<string>, frontier: number): NodeState {
  if (completed.has(nodes[index].id)) return "completed";
  if (index === frontier) return "current";
  return "locked";
}
