import { useMemo, useState } from "react";
import { ACCOUNTS, ELEMENTS } from "../domain/constants.ts";
import { journalSlots, shuffled, tokenId } from "../domain/questions.ts";
import type {
  Answer,
  ClassifyQuestion,
  FillBlankQuestion,
  JournalAnswer,
  JournalBlankAnswer,
  JournalBlankQuestion,
  JournalQuestion,
  JournalRow,
  Question,
  Side,
  TwoChoiceQuestion,
} from "../domain/types.ts";

/* ---------------------------------------------------------
   問題フォーマット
--------------------------------------------------------- */

interface Props<Q extends Question, A extends Answer> {
  q: Q;
  answer: A;
  setAnswer: (a: Answer) => void;
}

const choiceCls = (selected: boolean) =>
  `rounded-2xl font-extrabold border-b-4 transition-transform active:translate-y-0.5 active:border-b-2
  ${selected ? "bg-sky-500 border-sky-600 text-white" : "bg-white border-gray-200 text-gray-700"}`;

function ClassifyView({ q, answer, setAnswer }: Props<ClassifyQuestion, string | null>) {
  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">どの要素？</p>
      <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-center">
        <p className="text-2xl font-extrabold text-gray-800">{q.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ELEMENTS.map((el) => (
          <button key={el} onClick={() => setAnswer(el)} className={`py-3 ${choiceCls(answer === el)}`}>
            {el}
          </button>
        ))}
      </div>
    </div>
  );
}

function TwoChoiceView({ q, answer, setAnswer }: Props<TwoChoiceQuestion, string | null>) {
  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">正しいのはどっち？</p>
      <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-center">
        <p className="text-lg font-extrabold text-gray-800">{q.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt) => (
          <button key={opt} onClick={() => setAnswer(opt)} className={`py-4 ${choiceCls(answer === opt)}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function FillBlankView({ q, answer, setAnswer }: Props<FillBlankQuestion, string | null>) {
  const [before, after] = q.prompt.split("［　］");
  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">空欄を埋めよう</p>
      <div className="bg-gray-50 rounded-2xl p-6 mb-6">
        <p className="text-base font-bold text-gray-800 leading-relaxed">
          {before}
          <span className="inline-block min-w-16 border-b-2 border-sky-400 text-sky-600 text-center mx-1">{answer || "　"}</span>
          {after}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt) => (
          <button key={opt} onClick={() => setAnswer(opt)} className={`py-3 ${choiceCls(answer === opt)}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function JournalView({ q, answer, setAnswer }: Props<JournalQuestion, JournalAnswer>) {
  const update = (field: keyof JournalAnswer, value: string) => setAnswer({ ...answer, [field]: value });
  const selectCls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-700 bg-white";
  const inputCls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-700";

  const sideRow = (label: string, accountField: "debitAccount" | "creditAccount", amountField: "debitAmount" | "creditAmount") => (
    <div>
      <p className="text-xs font-extrabold text-gray-400 mb-1">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <select className={selectCls} value={answer[accountField]} onChange={(e) => update(accountField, e.target.value)}>
          <option value="">科目を選択</option>
          {ACCOUNTS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          placeholder="金額"
          className={inputCls}
          value={answer[amountField]}
          onChange={(e) => update(amountField, e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">仕訳をつくろう</p>
      <div className="bg-gray-50 rounded-2xl p-4 mb-5">
        <p className="text-base font-bold text-gray-800">{q.prompt}</p>
      </div>
      <div className="space-y-3">
        {sideRow("借方", "debitAccount", "debitAmount")}
        {sideRow("貸方", "creditAccount", "creditAmount")}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   仕訳穴埋め（単語バンク方式）
   借方・貸方のうち片側だけを空欄にし、反対側は答えとして最初から見せる。
   両側を空欄にすると埋める順番に迷うため、問う側を1つに絞っている。
   空欄が複数ある場合は、埋めたいセルをタップして選んでから語を入れる。
--------------------------------------------------------- */

function JournalBlankView({ q, answer, setAnswer }: Props<JournalBlankQuestion, JournalBlankAnswer>) {
  // 選択肢は毎回並び順を変えるが、同じ問題を解いている間は固定する
  const tokens = useMemo(() => shuffled(q.choices.map((label, i) => ({ id: tokenId(q, i), label }))), [q]);

  const slots = journalSlots(q);
  const placed = answer.slots;
  const usedIds = Object.values(placed).filter(Boolean);

  const [activeKey, setActiveKey] = useState<string | null>(slots[0] ? slots[0].key : null);
  const tokenById = (id: string) => tokens.find((t) => t.id === id);

  // 埋める対象は、選択中のセル。未選択なら先頭の空きセル。
  const targetKey = (): string | null => {
    if (activeKey && !placed[activeKey]) return activeKey;
    const empty = slots.find((s) => !placed[s.key]);
    return empty ? empty.key : null;
  };

  const placeToken = (token: { id: string }) => {
    const key = targetKey();
    if (!key) return;
    const next = { ...placed, [key]: token.id };
    setAnswer({ slots: next });
    const nextEmpty = slots.find((s) => !next[s.key]);
    setActiveKey(nextEmpty ? nextEmpty.key : null);
  };

  const handleSlotTap = (key: string) => {
    if (placed[key]) {
      const next = { ...placed };
      delete next[key];
      setAnswer({ slots: next });
    }
    setActiveKey(key);
  };

  const multiSlot = slots.length > 1;
  const sideLabel = q.blankSide === "debit" ? "借方" : "貸方";

  const renderCell = (row: JournalRow, rowIndex: number, side: Side) => {
    const isDebit = side === "debit";
    const account = isDebit ? row.debitAnswer : row.creditAnswer;
    const amount = isDebit ? row.debitAmount : row.creditAmount;

    if (!account) return <div className="flex-1 px-3 py-3" />;

    const isBlank = q.blankSide === side;
    const key = `${isDebit ? "d" : "c"}${rowIndex}`;
    const token = isBlank && placed[key] ? tokenById(placed[key]) : null;
    const isActive = isBlank && multiSlot && targetKey() === key;

    return (
      <div className="flex-1 flex items-center gap-1 px-2 py-2 min-w-0">
        {isBlank ? (
          <button
            onClick={() => handleSlotTap(key)}
            className={`flex-1 min-w-0 min-h-10 py-1 rounded-xl text-sm font-extrabold px-1 leading-tight break-words transition-colors
              ${token ? "bg-sky-500 text-white" : "border-2 border-dashed text-gray-300"}
              ${!token && isActive ? "border-sky-400 bg-sky-50" : ""}
              ${!token && !isActive ? "border-gray-300" : ""}
            `}
          >
            {token ? token.label : "？"}
          </button>
        ) : (
          <span className="flex-1 min-w-0 min-h-10 flex items-center text-sm font-extrabold text-gray-700 px-1 leading-tight break-words">
            {account}
          </span>
        )}
        <span className="text-xs font-bold text-gray-600 shrink-0 tabular-nums">{amount.toLocaleString()}</span>
      </div>
    );
  };

  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">
        {sideLabel}の勘定科目を入れよう
        {multiSlot && <span className="ml-1 text-gray-300">（入れたい欄をタップして選べます）</span>}
      </p>
      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <p className="text-base font-bold text-gray-800">{q.prompt}</p>
      </div>

      <div className="border-2 border-gray-200 rounded-2xl overflow-hidden mb-6">
        <div className="flex bg-gray-100 text-xs font-extrabold">
          <div className={`flex-1 px-3 py-2 border-r border-gray-200 ${q.blankSide === "debit" ? "text-sky-600" : "text-gray-400"}`}>借方</div>
          <div className={`flex-1 px-3 py-2 ${q.blankSide === "credit" ? "text-sky-600" : "text-gray-400"}`}>貸方</div>
        </div>
        {q.rows.map((r, ri) => (
          <div key={ri} className="flex border-t border-gray-200">
            <div className="flex-1 flex border-r border-gray-200 min-w-0">{renderCell(r, ri, "debit")}</div>
            <div className="flex-1 flex min-w-0">{renderCell(r, ri, "credit")}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start content-start gap-2 justify-center min-h-24">
        {tokens.map((t) => {
          const used = usedIds.includes(t.id);
          // 使用中でも同じ大きさの枠を残し、他のボタンが動かないようにする
          return (
            <button
              key={t.id}
              disabled={used}
              onClick={() => placeToken(t)}
              className={`px-4 py-2 rounded-xl border-2 border-b-4 font-extrabold text-sm transition-transform
                ${used ? "bg-gray-100 border-gray-100 text-transparent" : "bg-white border-gray-200 text-gray-700 active:translate-y-0.5 active:border-b-2"}
              `}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function QuestionRenderer({ q, answer, setAnswer }: { q: Question; answer: Answer; setAnswer: (a: Answer) => void }) {
  switch (q.format) {
    case "classify":
      return <ClassifyView q={q} answer={answer as string | null} setAnswer={setAnswer} />;
    case "twochoice":
      return <TwoChoiceView q={q} answer={answer as string | null} setAnswer={setAnswer} />;
    case "fillblank":
      return <FillBlankView q={q} answer={answer as string | null} setAnswer={setAnswer} />;
    case "journal":
      return <JournalView q={q} answer={answer as JournalAnswer} setAnswer={setAnswer} />;
    case "journalBlank":
      return <JournalBlankView q={q} answer={answer as JournalBlankAnswer} setAnswer={setAnswer} />;
    default: {
      const unreachable: never = q;
      return unreachable;
    }
  }
}
