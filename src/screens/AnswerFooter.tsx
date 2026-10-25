import { Check, X } from "lucide-react";
import { correctAnswerText } from "../domain/questions.ts";
import type { Question } from "../domain/types.ts";

// レッスンと復習で共通の、判定ボタンとフィードバックバー
export function AnswerFooter({
  question,
  ready,
  checked,
  correct,
  correctLabel,
  wrongLabel,
  onCheck,
  onContinue,
}: {
  question: Question;
  ready: boolean;
  checked: boolean;
  correct: boolean;
  correctLabel: string;
  wrongLabel: string;
  onCheck: () => void;
  onContinue: () => void;
}) {
  return (
    <div className={`px-5 py-4 border-t ${checked ? (correct ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100") : "bg-gray-50 border-gray-100"}`}>
      {checked && (
        <div className="mb-3" role="status">
          <p className={`font-extrabold flex items-center gap-2 ${correct ? "text-green-600" : "text-red-500"}`}>
            {correct ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            {correct ? correctLabel : wrongLabel}
          </p>
          {!correct && (
            <p className="text-sm text-gray-600 mt-1">
              正解：<span className="font-bold">{correctAnswerText(question)}</span>
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">{question.explanation}</p>
        </div>
      )}

      {!checked ? (
        <button
          disabled={!ready}
          onClick={onCheck}
          className={`w-full py-3 rounded-2xl font-extrabold border-b-4 transition-transform active:translate-y-0.5 active:border-b-2
            ${ready ? "bg-green-500 border-green-600 text-white" : "bg-gray-200 border-gray-300 text-gray-400"}
          `}
        >
          こたえを確認
        </button>
      ) : (
        <button
          onClick={onContinue}
          className={`w-full py-3 rounded-2xl font-extrabold border-b-4 text-white transition-transform active:translate-y-0.5 active:border-b-2
            ${correct ? "bg-green-500 border-green-600" : "bg-red-500 border-red-600"}
          `}
        >
          つづける
        </button>
      )}
    </div>
  );
}
