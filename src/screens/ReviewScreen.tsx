import { useState } from "react";
import { Heart, X } from "lucide-react";
import { PrimaryButton } from "../components/parts.tsx";
import { QuestionRenderer } from "../components/QuestionRenderer.tsx";
import { emptyAnswer, gradeAnswer, isAnswerReady } from "../domain/questions.ts";
import type { Answer, WrongEntry } from "../domain/types.ts";
import { AnswerFooter } from "./AnswerFooter.tsx";

/* ---------------------------------------------------------
   まちがえた問題の復習画面
   正解した問題はリストから外れ、ライフが1つ戻る。
--------------------------------------------------------- */

export function ReviewScreen({ wrongToday, onCorrect, onClose }: { wrongToday: WrongEntry[]; onCorrect: (key: string) => void; onClose: () => void }) {
  const entry = wrongToday[0];

  if (!entry) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <Heart className="w-16 h-16 text-red-400 fill-red-400 mb-4" />
        <p className="text-xl font-extrabold text-gray-800 mb-2">今日の間違いはありません</p>
        <p className="text-gray-400 text-sm mb-8">ライフはフル回復しています</p>
        <PrimaryButton onClick={onClose}>マップにもどる</PrimaryButton>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-gray-400" aria-label="とじる">
          <X className="w-6 h-6" />
        </button>
        <p className="flex-1 text-center font-extrabold text-gray-600 text-sm">まちがえた問題の復習・のこり{wrongToday.length}問</p>
        <div className="w-6" />
      </div>
      {/* 問題が切り替わるたびに入力状態を作り直す */}
      <ReviewItem key={entry.key} entry={entry} onCorrect={onCorrect} />
    </div>
  );
}

function ReviewItem({ entry, onCorrect }: { entry: WrongEntry; onCorrect: (key: string) => void }) {
  const q = entry.question;
  const [answer, setAnswer] = useState<Answer>(() => emptyAnswer(q));
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [turn, setTurn] = useState(0);

  const handleCheck = () => {
    setCorrect(gradeAnswer(q, answer));
    setChecked(true);
  };

  const handleContinue = () => {
    if (correct) {
      onCorrect(entry.key);
      return;
    }
    setAnswer(emptyAnswer(q));
    setChecked(false);
    setTurn((n) => n + 1);
  };

  return (
    <>
      <div className="flex-1 px-5 py-4">
        <QuestionRenderer key={turn} q={q} answer={answer} setAnswer={setAnswer} />
      </div>
      <AnswerFooter
        question={q}
        ready={isAnswerReady(q, answer)}
        checked={checked}
        correct={correct}
        correctLabel="せいかい！ライフが回復に近づいた"
        wrongLabel="もういちど挑戦しよう"
        onCheck={handleCheck}
        onContinue={handleContinue}
      />
    </>
  );
}
