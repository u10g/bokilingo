import { useState } from "react";
import { Flame, Gem } from "lucide-react";
import { DetailHeader } from "../components/parts.tsx";
import { todayStr, type CompletedSets } from "../domain/progress.ts";
import type { Course } from "../domain/types.ts";

/* ---------------------------------------------------------
   継続記録 / 学習の記録 / コース選択
--------------------------------------------------------- */

export function StreakDetailScreen({ streak, lastActiveDate, onClose }: { streak: number; lastActiveDate: string | null; onClose: () => void }) {
  const today = new Date();
  const anchor = lastActiveDate && lastActiveDate !== todayStr() ? new Date(lastActiveDate + "T00:00:00") : today;
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const todayDate = today.getDate();
  const anchorDate = anchor.getDate();

  const activeDays = new Set<number>();
  for (let i = 0; i < streak; i++) {
    const d = anchorDate - i;
    if (d >= 1) activeDays.add(d);
  }

  const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="min-h-screen bg-white px-5 py-4">
      <DetailHeader title="継続記録" onClose={onClose} />
      <div className="flex flex-col items-center mb-8">
        <Flame className="w-16 h-16 text-orange-500 fill-orange-500 mb-2" />
        <p className="text-3xl font-extrabold text-gray-800">{streak}日連続</p>
        <p className="text-gray-400 text-sm mt-1">毎日クリアして記録を伸ばそう</p>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekLabels.map((w) => (
          <span key={w} className="text-xs font-bold text-gray-400">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            {d && (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${d === todayDate ? "ring-2 ring-orange-500" : ""}
                  ${activeDays.has(d) ? "bg-orange-100 text-orange-600" : "text-gray-400"}
                `}
              >
                {d}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressDetailScreen({
  courses,
  solvedCount,
  totalXp,
  completedSets,
  onResetData,
  onClose,
}: {
  courses: Course[];
  solvedCount: number;
  totalXp: number;
  completedSets: CompletedSets;
  onResetData: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="min-h-screen bg-white px-5 py-4 flex flex-col">
      <DetailHeader title="学習の記録" onClose={onClose} />
      <div className="flex flex-col items-center mb-6">
        <Gem className="w-16 h-16 text-sky-500 mb-2" />
        <p className="text-3xl font-extrabold text-gray-800">{solvedCount}問</p>
        <p className="text-gray-400 text-sm mt-1">これまでにクリアした問題数（全コース合計）</p>
      </div>

      <div className="bg-amber-50 rounded-2xl py-3 mb-6 text-center">
        <p className="text-amber-500 font-extrabold text-xl">{totalXp.toLocaleString()} XP</p>
        <p className="text-xs text-gray-400 font-bold">累計獲得XP</p>
      </div>

      <div className="space-y-2">
        {courses.map((c) => {
          const set = completedSets[c.id];
          const count = c.nodes.reduce((sum, n, i) => (set.has(i) ? sum + n.questions.length : sum), 0);
          return (
            <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <span className="font-bold text-gray-600">{c.title}</span>
              <span className="font-extrabold text-sky-500">{count}問</span>
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-8 flex flex-col items-center">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="text-gray-300 text-xs font-bold underline">
            この端末の学習データをリセット
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-bold">元に戻せません。削除しますか？</span>
            <button onClick={onResetData} className="text-xs font-extrabold text-red-500">
              削除する
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs font-extrabold text-gray-400">
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CourseSelectScreen({
  courses,
  activeCourseId,
  completedSets,
  onSelect,
  onClose,
}: {
  courses: Course[];
  activeCourseId: string;
  completedSets: CompletedSets;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="min-h-screen bg-white px-5 py-4">
      <DetailHeader title="コースをえらぶ" onClose={onClose} />
      <div className="space-y-3">
        {courses.map((c) => {
          const done = completedSets[c.id].size;
          const active = c.id === activeCourseId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left rounded-2xl p-4 border-2 transition-colors ${active ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-extrabold text-gray-800">{c.title}</p>
                {active && <span className="text-xs font-extrabold text-green-600 bg-white px-2 py-0.5 rounded-full">学習中</span>}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{c.subtitle}</p>
              <p className="text-xs text-gray-400 mt-2 font-bold">
                {done}/{c.nodes.length} レッスン完了
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
