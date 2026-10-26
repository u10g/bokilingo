import { useMemo, useState } from "react";
import { ACCOUNTS, ELEMENTS } from "../domain/constants.ts";
import { journalSlots, ledgerSlots, shuffled, tableSlots, tokenId, type JournalSlot } from "../domain/questions.ts";
import type {
  Answer,
  ClassifyQuestion,
  FillBlankQuestion,
  JournalAnswer,
  JournalBlankAnswer,
  JournalBlankQuestion,
  JournalQuestion,
  JournalRow,
  LedgerAccountQuestion,
  LedgerEntry,
  MultiSelectQuestion,
  Question,
  Side,
  TableBlankQuestion,
  TableCell,
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

// 選択肢は毎回並び順を変える（問題データでは正解を先頭に書いている）。同じ問題を解いている間は固定する
const useShuffledOptions = (q: { options: string[] }) => useMemo(() => shuffled(q.options), [q]);

function TwoChoiceView({ q, answer, setAnswer }: Props<TwoChoiceQuestion, string | null>) {
  const options = useShuffledOptions(q);
  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">正しいのはどっち？</p>
      <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-center">
        <p className="text-lg font-extrabold text-gray-800">{q.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
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
  const options = useShuffledOptions(q);
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
        {options.map((opt) => (
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

// 単語バンクの操作（仕訳穴埋め・表の穴埋め・ストーリーで共通）
export function useTokenBank(q: { id: string; choices: string[] }, slots: JournalSlot[], answer: JournalBlankAnswer, setAnswer: (a: Answer) => void) {
  // 選択肢は毎回並び順を変えるが、同じ問題を解いている間は固定する
  const tokens = useMemo(() => shuffled(q.choices.map((label, i) => ({ id: tokenId(q, i), label }))), [q]);
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

  return { tokens, placed, usedIds, tokenById, targetKey, placeToken, handleSlotTap };
}

export function TokenBank({ tokens, usedIds, onPick }: { tokens: { id: string; label: string }[]; usedIds: string[]; onPick: (t: { id: string }) => void }) {
  return (
    <div className="flex flex-wrap items-start content-start gap-2 justify-center min-h-24">
      {tokens.map((t) => {
        const used = usedIds.includes(t.id);
        // 使用中でも同じ大きさの枠を残し、他のボタンが動かないようにする
        return (
          <button
            key={t.id}
            disabled={used}
            onClick={() => onPick(t)}
            className={`px-4 py-2 rounded-xl border-2 border-b-4 font-extrabold text-sm transition-transform
              ${used ? "bg-gray-100 border-gray-100 text-transparent" : "bg-white border-gray-200 text-gray-700 active:translate-y-0.5 active:border-b-2"}
            `}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function JournalBlankView({ q, answer, setAnswer }: Props<JournalBlankQuestion, JournalBlankAnswer>) {
  const slots = journalSlots(q);
  const { tokens, placed, usedIds, tokenById, targetKey, placeToken, handleSlotTap } = useTokenBank(q, slots, answer, setAnswer);

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

      <TokenBank tokens={tokens} usedIds={usedIds} onPick={placeToken} />
    </div>
  );
}

/* ---------------------------------------------------------
   表の穴埋め（商品有高帳・財務諸表など）
   単語バンクの操作は仕訳穴埋めと同じ。列が多い表でも375px幅に収まるよう、文字を小さくする。
--------------------------------------------------------- */

function TableBlankView({ q, answer, setAnswer }: Props<TableBlankQuestion, JournalBlankAnswer>) {
  const slots = tableSlots(q);
  const { tokens, placed, usedIds, tokenById, targetKey, placeToken, handleSlotTap } = useTokenBank(q, slots, answer, setAnswer);
  const multiSlot = slots.length > 1;

  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">
        表の空欄を埋めよう
        {multiSlot && <span className="ml-1 text-gray-300">（入れたい欄をタップして選べます）</span>}
      </p>
      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <p className="text-base font-bold text-gray-800 whitespace-pre-line">{q.prompt}</p>
      </div>

      <p className="text-xs font-extrabold text-gray-500 mb-1">{q.caption}</p>
      <div className="border-2 border-gray-200 rounded-2xl overflow-hidden mb-6">
        <table className="w-full table-fixed text-xs">
          <thead className="bg-gray-100">
            <tr>
              {q.columns.map((c, i) => (
                <th key={i} className="px-1 py-2 font-extrabold text-gray-500 border-r last:border-r-0 border-gray-200">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-gray-200">
                {row.map((cell, ci) => {
                  const key = `r${ri}c${ci}`;
                  if (typeof cell === "string") {
                    return (
                      <td key={ci} className="px-1 py-2 text-center font-bold text-gray-700 border-r last:border-r-0 border-gray-200 break-words tabular-nums">
                        {cell}
                      </td>
                    );
                  }
                  const token = placed[key] ? tokenById(placed[key]) : null;
                  const isActive = multiSlot && targetKey() === key;
                  return (
                    <td key={ci} className="p-0.5 border-r last:border-r-0 border-gray-200">
                      <button
                        onClick={() => handleSlotTap(key)}
                        aria-label={`空欄 ${ri + 1}行${ci + 1}列`}
                        className={`w-full min-h-9 rounded-lg font-extrabold leading-tight break-words tabular-nums transition-colors
                          ${token ? "bg-sky-500 text-white" : "border-2 border-dashed text-gray-300"}
                          ${!token && isActive ? "border-sky-400 bg-sky-50" : ""}
                          ${!token && !isActive ? "border-gray-300" : ""}
                        `}
                      >
                        {token ? token.label : "？"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TokenBank tokens={tokens} usedIds={usedIds} onPick={placeToken} />
    </div>
  );
}

/* ---------------------------------------------------------
   勘定記入（T勘定）
   本試験の勘定は「日付・摘要・金額」が左右に並び6列になるため、
   各行を「日付・摘要」と「金額」の2段にして借方・貸方の2列に収める。
--------------------------------------------------------- */

function LedgerAccountView({ q, answer, setAnswer }: Props<LedgerAccountQuestion, JournalBlankAnswer>) {
  const slots = ledgerSlots(q);
  const { tokens, placed, usedIds, tokenById, targetKey, placeToken, handleSlotTap } = useTokenBank(q, slots, answer, setAnswer);
  const multiSlot = slots.length > 1;

  const renderCell = (cell: TableCell, key: string, className: string) => {
    if (typeof cell === "string") return <span className={className}>{cell}</span>;
    const token = placed[key] ? tokenById(placed[key]) : null;
    const isActive = multiSlot && targetKey() === key;
    return (
      <button
        onClick={() => handleSlotTap(key)}
        aria-label={`空欄 ${key}`}
        className={`min-w-16 min-h-7 px-1.5 rounded-lg text-xs font-extrabold tabular-nums transition-colors
          ${token ? "bg-sky-500 text-white" : "border-2 border-dashed text-gray-300"}
          ${!token && isActive ? "border-sky-400 bg-sky-50" : ""}
          ${!token && !isActive ? "border-gray-300" : ""}
        `}
      >
        {token ? token.label : "？"}
      </button>
    );
  };

  const renderSide = (entries: LedgerEntry[], side: "d" | "c") => (
    <div className="flex-1 min-w-0">
      {entries.map((e, i) => (
        <div key={i} className="px-2 py-1.5 border-b border-dashed border-gray-200">
          <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
            <span className="shrink-0 tabular-nums">{e.date}</span>
            {renderCell(e.desc, `${side}${i}n`, "truncate text-gray-700")}
          </div>
          <div className="flex justify-end mt-0.5">{renderCell(e.amount, `${side}${i}a`, "text-sm font-extrabold text-gray-800 tabular-nums")}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">
        勘定の空欄を埋めよう
        {multiSlot && <span className="ml-1 text-gray-300">（入れたい欄をタップして選べます）</span>}
      </p>
      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <p className="text-base font-bold text-gray-800 whitespace-pre-line">{q.prompt}</p>
      </div>

      <div className="mb-6">
        <p className="text-center font-extrabold text-gray-700 border-b-2 border-gray-700 pb-1">{q.account}</p>
        <div className="flex text-xs font-extrabold text-gray-400">
          <div className="flex-1 px-2 py-1">借方</div>
          <div className="flex-1 px-2 py-1 text-right">貸方</div>
        </div>
        <div className="flex">
          <div className="flex-1 flex border-r-2 border-gray-700 min-w-0">{renderSide(q.debit, "d")}</div>
          <div className="flex-1 flex min-w-0">{renderSide(q.credit, "c")}</div>
        </div>
        {q.total !== undefined && (
          <div className="flex border-t-4 border-double border-gray-700">
            {[0, 1].map((i) => (
              <div key={i} className={`flex-1 flex justify-between items-center px-2 py-1.5 ${i === 0 ? "border-r-2 border-gray-700" : ""}`}>
                <span className="text-xs font-bold text-gray-400">合計</span>
                {renderCell(q.total!, "t", "text-sm font-extrabold text-gray-800 tabular-nums")}
              </div>
            ))}
          </div>
        )}
      </div>

      <TokenBank tokens={tokens} usedIds={usedIds} onPick={placeToken} />
    </div>
  );
}

/* ---------------------------------------------------------
   複数選択（補助簿の選択など）
   当てはまるものをすべて選ぶ。もう一度押すと選択を外す。
--------------------------------------------------------- */

function MultiSelectView({ q, answer, setAnswer }: Props<MultiSelectQuestion, string[]>) {
  const toggle = (opt: string) => setAnswer(answer.includes(opt) ? answer.filter((x) => x !== opt) : [...answer, opt]);
  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">当てはまるものをすべて選ぼう</p>
      <div className="bg-gray-50 rounded-2xl p-4 mb-6">
        <p className="text-base font-bold text-gray-800">{q.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {q.options.map((opt) => (
          <button key={opt} onClick={() => toggle(opt)} aria-pressed={answer.includes(opt)} className={`py-2.5 px-2 text-sm ${choiceCls(answer.includes(opt))}`}>
            {opt}
          </button>
        ))}
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
    case "tableBlank":
      return <TableBlankView q={q} answer={answer as JournalBlankAnswer} setAnswer={setAnswer} />;
    case "multiSelect":
      return <MultiSelectView q={q} answer={answer as string[]} setAnswer={setAnswer} />;
    case "ledgerAccount":
      return <LedgerAccountView q={q} answer={answer as JournalBlankAnswer} setAnswer={setAnswer} />;
    default: {
      const unreachable: never = q;
      return unreachable;
    }
  }
}
