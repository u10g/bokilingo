import { Heart, Trophy } from "lucide-react";
import { PrimaryButton } from "../components/parts.tsx";
import { PASS_RATE, XP_PER_QUESTION } from "../domain/constants.ts";
import type { LessonNode, LessonResult } from "../domain/types.ts";

/* ---------------------------------------------------------
   クリア / ライフ切れ
--------------------------------------------------------- */

export function ClearScreen({ result, node, onContinue, onRetry }: { result: LessonResult; node: LessonNode; onContinue: () => void; onRetry: () => void }) {
  const accuracy = Math.round(((result.total - result.missed) / result.total) * 100);
  const xpEarned = result.total * XP_PER_QUESTION;
  const isCheckpoint = node.kind === "review";
  const passed = accuracy >= PASS_RATE * 100;
  const failedCheckpoint = isCheckpoint && !passed;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white text-center">
      {failedCheckpoint ? <Trophy className="w-20 h-20 text-gray-300 mb-4" /> : <Trophy className="w-20 h-20 text-amber-400 fill-amber-400 mb-4" />}
      <p className="text-2xl font-extrabold text-gray-800 mb-1">{failedCheckpoint ? "もう一歩！" : "レッスンクリア！"}</p>
      <p className="text-gray-500 mb-6">{node.title}</p>

      {isCheckpoint && (
        <div className={`mb-6 px-4 py-2 rounded-full font-extrabold text-sm ${passed ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
          {passed ? "合格ライン突破！" : `正答率${PASS_RATE * 100}%以上で合格です`}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8">
        <div className="bg-amber-50 rounded-2xl py-4">
          <p className="text-amber-500 font-extrabold text-lg">+{xpEarned}</p>
          <p className="text-xs text-gray-400 font-bold">XP</p>
        </div>
        <div className={`rounded-2xl py-4 ${passed ? "bg-green-50" : "bg-red-50"}`}>
          <p className={`font-extrabold text-lg ${passed ? "text-green-600" : "text-red-500"}`}>{accuracy}%</p>
          <p className="text-xs text-gray-400 font-bold">正解率</p>
        </div>
      </div>

      {failedCheckpoint ? (
        <>
          <PrimaryButton onClick={onRetry} className="mb-3">
            もう一度挑戦する
          </PrimaryButton>
          <button onClick={onContinue} className="text-gray-400 font-bold text-sm">
            あとでマップにもどる
          </button>
        </>
      ) : (
        <PrimaryButton onClick={onContinue}>つづける</PrimaryButton>
      )}
    </div>
  );
}

export function HeartsEmptyScreen({ onReview, onBackToMap }: { onReview: () => void; onBackToMap: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white text-center">
      <Heart className="w-20 h-20 text-gray-300 mb-4" />
      <p className="text-xl font-extrabold text-gray-800 mb-2">ライフがなくなりました</p>
      <p className="text-gray-500 mb-8 text-sm">まちがえた問題を復習するとライフが回復します</p>
      <PrimaryButton onClick={onReview} className="mb-3">
        まちがえた問題を復習する
      </PrimaryButton>
      <button onClick={onBackToMap} className="text-gray-400 font-bold text-sm">
        あとでマップにもどる
      </button>
    </div>
  );
}
