import { useState } from "react";
import { Target, X } from "lucide-react";
import { PrimaryButton } from "../components/parts.tsx";
import { QuestionRenderer } from "../components/QuestionRenderer.tsx";
import { emptyAnswer, gradeAnswer, isAnswerReady } from "../domain/questions.ts";
import type { Answer, Question } from "../domain/types.ts";
import { AnswerFooter } from "./AnswerFooter.tsx";

/* ---------------------------------------------------------
   苦手な問題の復習
   日をまたいで、過去に間違えた問題を1問ずつ解き直す。
   練習扱いのため、間違えてもライフは減らず、再出題もしない（誤答は記録する）。
--------------------------------------------------------- */

export function WeakReviewScreen({
  questions,
  graduatedCount,
  onAnswer,
  onClose,
}: {
  questions: Question[];
  graduatedCount: number; // この復習で苦手から卒業した問題数
  onAnswer: (q: Question, ok: boolean) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  if (index >= questions.length) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <Target className="w-16 h-16 text-violet-500 mb-4" />
        <p className="text-xl font-extrabold text-gray-800 mb-1">苦手の復習おわり</p>
        <p className="text-gray-500 mb-6">
          {questions.length}問中 {correctCount}問 正解
        </p>
        <div className="bg-violet-50 rounded-2xl px-6 py-3 mb-8">
          <p className="text-violet-600 font-extrabold text-lg">{graduatedCount}問</p>
          <p className="text-xs text-gray-400 font-bold">苦手から卒業（別々の2日で正解）</p>
        </div>
        <PrimaryButton onClick={onClose}>マップにもどる</PrimaryButton>
      </div>
    );
  }

  const handleNext = (ok: boolean) => {
    if (ok) setCorrectCount((n) => n + 1);
    setIndex((i) => i + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-gray-400" aria-label="苦手の復習を終える">
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${Math.round((index / questions.length) * 100)}%` }} />
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1">
            苦手の復習・{index + 1}問目／全{questions.length}問
          </p>
        </div>
      </div>
      {/* 問題が切り替わるたびに入力状態を作り直す */}
      <WeakItem key={questions[index].id} q={questions[index]} onAnswer={onAnswer} onNext={handleNext} />
    </div>
  );
}

function WeakItem({ q, onAnswer, onNext }: { q: Question; onAnswer: (q: Question, ok: boolean) => void; onNext: (ok: boolean) => void }) {
  const [answer, setAnswer] = useState<Answer>(() => emptyAnswer(q));
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);

  const handleCheck = () => {
    const ok = gradeAnswer(q, answer);
    setCorrect(ok);
    setChecked(true);
    onAnswer(q, ok);
  };

  return (
    <>
      <div className="flex-1 px-5 py-4">
        <QuestionRenderer q={q} answer={answer} setAnswer={setAnswer} />
      </div>
      <AnswerFooter
        question={q}
        ready={isAnswerReady(q, answer)}
        checked={checked}
        correct={correct}
        correctLabel="せいかい！"
        wrongLabel="まだ苦手。また明日やろう"
        onCheck={handleCheck}
        onContinue={() => onNext(correct)}
      />
    </>
  );
}
