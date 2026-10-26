import { useState } from "react";
import { Heart, X } from "lucide-react";
import { QuestionRenderer } from "../components/QuestionRenderer.tsx";
import { PRAISE } from "../domain/constants.ts";
import { emptyAnswer, gradeAnswer, isAnswerReady, shuffled } from "../domain/questions.ts";
import type { Answer, LessonResult, Question } from "../domain/types.ts";
import { AnswerFooter } from "./AnswerFooter.tsx";

/* ---------------------------------------------------------
   レッスン画面
   誤答した問題はキューの末尾に戻し、全問正解するまで終わらない。
--------------------------------------------------------- */

export function LessonScreen({
  questions,
  hearts,
  onWrongAnswer,
  onCorrectAnswer,
  onExit,
  onComplete,
}: {
  questions: Question[]; // 出題する問題。セクション復習では候補から選んだ一部
  hearts: number;
  onWrongAnswer: (q: Question) => void;
  onCorrectAnswer: (q: Question) => void;
  onExit: () => void;
  onComplete: (result: LessonResult) => void;
}) {
  const [queue, setQueue] = useState<Question[]>(() => shuffled(questions));
  const [answer, setAnswer] = useState<Answer>(() => emptyAnswer(queue[0]));
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => new Set());
  const [missedIds, setMissedIds] = useState<Set<string>>(() => new Set());
  const [confirmExit, setConfirmExit] = useState(false);
  // 同じ問題が再出題されても入力欄を作り直すための通し番号
  const [turn, setTurn] = useState(0);

  const total = questions.length;
  const current = queue[0];
  const progress = Math.round((masteredIds.size / total) * 100);
  const started = masteredIds.size > 0 || missedIds.size > 0 || checked;

  const handleCheck = () => {
    const ok = gradeAnswer(current, answer);
    setCorrect(ok);
    setChecked(true);
    if (ok) {
      setMasteredIds((prev) => new Set(prev).add(current.id));
      onCorrectAnswer(current);
    } else {
      setMissedIds((prev) => new Set(prev).add(current.id));
      onWrongAnswer(current);
    }
  };

  const handleContinue = () => {
    if (hearts <= 0) return;
    const rest = queue.slice(1);
    const nextQueue = correct ? rest : [...rest, current];

    if (nextQueue.length === 0) {
      onComplete({ total, missed: missedIds.size });
      return;
    }
    setQueue(nextQueue);
    setAnswer(emptyAnswer(nextQueue[0]));
    setChecked(false);
    setTurn((n) => n + 1);
  };

  // 途中まで解いていた場合のみ、離脱前に確認する
  const handleExitRequest = () => {
    if (started) {
      setConfirmExit(true);
      return;
    }
    onExit();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={handleExitRequest} className="text-gray-400" aria-label="レッスンを中断する">
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1">
            のこり{queue.length}問／全{total}問
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label={`ライフ${hearts}`}>
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
          <span className="font-extrabold text-sm text-red-500">{hearts}</span>
        </div>
      </div>

      <div className="flex-1 px-5 py-4">
        <QuestionRenderer key={`${current.id}-${turn}`} q={current} answer={answer} setAnswer={setAnswer} />
      </div>

      <AnswerFooter
        question={current}
        ready={isAnswerReady(current, answer)}
        checked={checked}
        correct={correct}
        correctLabel={praise}
        wrongLabel="ざんねん"
        onCheck={handleCheck}
        onContinue={handleContinue}
      />

      {confirmExit && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmExit(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-2xl p-5 shadow-xl">
            <p className="text-lg font-extrabold text-gray-800 mb-1">レッスンを中断しますか？</p>
            <p className="text-sm text-gray-500 mb-5">このレッスンの進み具合は保存されません。</p>
            <button
              onClick={onExit}
              className="w-full font-extrabold py-3 rounded-2xl border-b-4 bg-red-500 border-red-600 text-white active:translate-y-0.5 active:border-b-2 transition-transform mb-2"
            >
              中断する
            </button>
            <button onClick={() => setConfirmExit(false)} className="w-full font-extrabold py-3 rounded-2xl text-gray-500">
              レッスンにもどる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
