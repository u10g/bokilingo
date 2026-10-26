/* ---------------------------------------------------------
   苦手な問題の記録と復習
   一度でも間違えた問題を「苦手」として残し、日をまたいで復習する。
   間違えた後、別々の2日で正解したら苦手から卒業する。
   同じ日に何度正解しても1日と数える（直後の再出題だけで卒業させないため）。
--------------------------------------------------------- */

export interface QuestionStat {
  miss: number; // これまでの誤答回数
  okDays: number; // 最後に間違えてから正解した日数
  lastOk: string | null; // 最後に正解した日（YYYY-MM-DD）
  lastMiss: string | null; // 最後に間違えた日。旧データから引き継いだものは不明なので null
}

export type QuestionStats = Record<string, QuestionStat>;

export const GRADUATE_DAYS = 2;
export const WEAK_REVIEW_SIZE = 10;

// 回答を記録した新しい統計を返す。変化がなければ同じオブジェクトを返す
export function recordAnswer(stats: QuestionStats, questionId: string, ok: boolean, today: string): QuestionStats {
  const s = stats[questionId];
  if (!ok) {
    return { ...stats, [questionId]: { miss: (s?.miss ?? 0) + 1, okDays: 0, lastOk: null, lastMiss: today } };
  }
  // 一度も間違えていない問題の正解は記録しない
  if (!s || s.lastOk === today) return stats;
  return { ...stats, [questionId]: { ...s, okDays: s.okDays + 1, lastOk: today } };
}

export function isWeak(s: QuestionStat | undefined): boolean {
  return Boolean(s && s.miss > 0 && s.okDays < GRADUATE_DAYS);
}

export function isGraduated(s: QuestionStat | undefined): boolean {
  return Boolean(s && s.miss > 0 && s.okDays >= GRADUATE_DAYS);
}

// 今日復習できる苦手な問題のID。誤答回数が多い順、最後に間違えた日が古い順。
// 今日間違えた問題は「今日の復習」で扱い、今日すでに正解した問題は明日に回す
export function weakQueue(stats: QuestionStats, today: string): string[] {
  return Object.entries(stats)
    .filter(([, s]) => isWeak(s) && s.lastMiss !== today && s.lastOk !== today)
    .sort(([, a], [, b]) => b.miss - a.miss || (a.lastMiss ?? "").localeCompare(b.lastMiss ?? ""))
    .map(([id]) => id);
}

// セクション復習の出題で使う、問題ID → 誤答回数
export function missCountsOf(stats: QuestionStats): Record<string, number> {
  return Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, s.miss]));
}

// 旧形式（誤答回数だけ）の保存データを引き継ぐ
export function fromMissCounts(missCounts: Record<string, number>): QuestionStats {
  return Object.fromEntries(
    Object.entries(missCounts)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => [id, { miss: n, okDays: 0, lastOk: null, lastMiss: null }]),
  );
}
