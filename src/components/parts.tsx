import type { ReactNode } from "react";
import { BookOpen, ChevronDown, Dumbbell, Flame, Gem, Heart, Lock, Star, Table2, Trophy, X } from "lucide-react";
import type { NodeState } from "../domain/progress.ts";
import type { ChapterInfo, LessonNode, NodeKind } from "../domain/types.ts";

/* ---------------------------------------------------------
   小さな見た目パーツ
--------------------------------------------------------- */

function StatButton({ icon, value, onClick, bg, label }: { icon: ReactNode; value: number; onClick: () => void; bg: string; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${bg}`}>
      {icon}
      <span className="font-extrabold text-sm text-gray-700">{value}</span>
    </button>
  );
}

export function DetailHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <button onClick={onClose} className="text-gray-400" aria-label="とじる">
        <X className="w-6 h-6" />
      </button>
      <p className="font-extrabold text-gray-800">{title}</p>
      <div className="w-6" />
    </div>
  );
}

export function Header({
  courseTitle,
  streak,
  solvedCount,
  hearts,
  onOpenCourses,
  onOpenStreak,
  onOpenProgress,
  onOpenReview,
}: {
  courseTitle: string;
  streak: number;
  solvedCount: number;
  hearts: number;
  onOpenCourses: () => void;
  onOpenStreak: () => void;
  onOpenProgress: () => void;
  onOpenReview: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
      <button onClick={onOpenCourses} className="flex items-center gap-1 shrink-0 min-w-0">
        <span className="font-extrabold text-green-600 text-base tracking-tight truncate max-w-32">{courseTitle}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <StatButton label="継続記録" icon={<Flame className="w-4 h-4 text-orange-500 fill-orange-500" />} value={streak} bg="bg-orange-50" onClick={onOpenStreak} />
        <StatButton label="学習の記録" icon={<Gem className="w-4 h-4 text-sky-500" />} value={solvedCount} bg="bg-sky-50" onClick={onOpenProgress} />
        <StatButton
          label="ライフ"
          icon={<Heart className={`w-4 h-4 text-red-500 ${hearts > 0 ? "fill-red-500" : ""}`} />}
          value={hearts}
          bg="bg-red-50"
          onClick={onOpenReview}
        />
      </div>
    </div>
  );
}

export function SectionBanner({ info, stats }: { info: ChapterInfo; stats?: { done: number; total: number } }) {
  const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <div className={`${info.bg} text-white rounded-2xl p-4 mb-6 shadow w-full`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${info.sub}`}>{info.title}</p>
      <p className="text-xl font-extrabold">{info.subtitle}</p>
      {stats && (
        <div className="mt-3">
          <div className="h-2 bg-black/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/90 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className={`text-xs font-bold mt-1 ${info.sub}`}>
            {stats.done}/{stats.total} レッスン完了
          </p>
        </div>
      )}
    </div>
  );
}

// 下側は「スタート」の吹き出しが区切り線に重ならないだけ空ける
export function UnitDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 w-full mt-3 mb-11">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

function NodeIcon({ kind, state }: { kind: NodeKind; state: NodeState }) {
  const cls = "w-7 h-7";
  if (state === "locked") return <Lock className={cls} />;
  if (state === "completed") return <Star className={`${cls} fill-white`} />;
  if (kind === "journal") return <Dumbbell className={cls} />;
  if (kind === "table") return <Table2 className={cls} />;
  if (kind === "review") return <Trophy className={cls} />;
  return <BookOpen className={cls} />;
}

// 蛇行パスはSVGを使わず、ノードごとの translateX で表現する
const OFFSETS = [0, 64, 96, 64, 0, -64, -96, -64];

const STYLE_BY_STATE: Record<NodeState, string> = {
  locked: "bg-gray-300 border-gray-400 text-gray-400",
  current: "bg-green-500 border-green-600 text-white",
  completed: "bg-amber-400 border-amber-500 text-white",
};

export function PathNode({ node, index, state, onTap }: { node: LessonNode; index: number; state: NodeState; onTap: (i: number) => void }) {
  const offset = OFFSETS[index % OFFSETS.length];
  return (
    <div className="relative flex flex-col items-center" style={{ transform: `translateX(${offset}px)`, marginBottom: "28px" }}>
      {state === "current" && (
        <div className="absolute -top-9 bg-white border border-gray-200 shadow px-3 py-1 rounded-xl text-xs font-extrabold text-green-600 whitespace-nowrap animate-bounce">
          スタート
        </div>
      )}
      <button
        onClick={() => onTap(index)}
        aria-label={node.title}
        className={`w-16 h-16 rounded-full border-b-4 flex items-center justify-center shadow-md
          active:translate-y-0.5 active:border-b-2 transition-transform
          ${STYLE_BY_STATE[state]}
          ${state === "current" ? "ring-4 ring-green-200" : ""}
        `}
      >
        <NodeIcon kind={node.kind} state={state} />
      </button>
      <span className="mt-2 text-xs font-bold text-gray-500 w-24 text-center leading-tight">{node.title}</span>
    </div>
  );
}

const KIND_LABEL: Record<NodeKind, string> = { classify: "5要素分類", journal: "仕訳穴埋め", table: "帳簿・表", review: "セクション復習" };
const KIND_COLOR: Record<NodeKind, string> = {
  classify: "text-green-600 bg-green-50",
  journal: "text-sky-600 bg-sky-50",
  table: "text-violet-600 bg-violet-50",
  review: "text-amber-600 bg-amber-50",
};

export function NodeSheet({ node, state, onStart, onClose }: { node: LessonNode; state: NodeState; onStart: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-t-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-extrabold px-2 py-1 rounded-full ${KIND_COLOR[node.kind]}`}>{KIND_LABEL[node.kind]}</span>
          <button onClick={onClose} className="text-gray-400" aria-label="とじる">
            <X className="w-5 h-5" />
          </button>
        </div>
        {node.unit && node.kind !== "review" && <p className="text-xs font-bold text-gray-400">{node.unit}</p>}
        <p className="text-lg font-extrabold text-gray-800">{node.title}</p>
        <p className="text-sm text-gray-500 mt-1 mb-5">{node.desc}</p>

        {state === "locked" && <p className="text-xs text-gray-400 font-bold mb-3">まだ解放されていません。先に進みたい場合はスキップできます。</p>}

        {state === "locked" ? (
          <button
            onClick={onStart}
            className="w-full font-extrabold py-3 rounded-2xl border border-gray-300 text-gray-500 bg-white active:bg-gray-50 transition-colors"
          >
            スキップしてレッスンを始める
          </button>
        ) : (
          <button
            onClick={onStart}
            className="w-full font-extrabold py-3 rounded-2xl border-b-4 bg-green-500 border-green-600 text-white active:translate-y-0.5 active:border-b-2 transition-transform"
          >
            {state === "completed" ? "れんしゅうする" : "レッスンをはじめる"}
          </button>
        )}
      </div>
    </div>
  );
}

export function PrimaryButton({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full max-w-xs bg-green-500 border-b-4 border-green-600 text-white font-extrabold py-3 rounded-2xl active:translate-y-0.5 active:border-b-2 transition-transform ${className}`}
    >
      {children}
    </button>
  );
}
