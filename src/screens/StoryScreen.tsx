import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ScrollText, X } from "lucide-react";
import { TokenBank, useTokenBank } from "../components/QuestionRenderer.tsx";
import { PRAISE } from "../domain/constants.ts";
import { adjustmentsUpTo, afterAmount, amountLabel, NET_KEY, NET_LABEL, stepChoices, stepSlots, visibleAccounts } from "../domain/story.ts";
import type { Answer, JournalBlankAnswer, LessonResult, Story, StoryAccount } from "../domain/types.ts";

/* ---------------------------------------------------------
   ストーリー画面（第3問の決算の流れ）
   ステップごとに「決算整理事項を読む → 修正記入を穴埋めする」をくり返し、
   1枚の表を完成させる。最後に当期純利益を求める。
   間違えたマスだけを空に戻し、正解するまで同じステップに留まる。ライフは減らない。
--------------------------------------------------------- */

export function StoryScreen({ story, onExit, onComplete }: { story: Story; onExit: () => void; onComplete: (r: LessonResult) => void }) {
  const total = story.steps.length + 1; // 決算整理事項 ＋ 当期純利益
  const [step, setStep] = useState(-1); // -1 はイントロ
  const [missed, setMissed] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);

  const handleNext = (missedThisStep: boolean) => {
    const nextMissed = missed + (missedThisStep ? 1 : 0);
    if (step === story.steps.length) {
      onComplete({ total, missed: nextMissed });
      return;
    }
    setMissed(nextMissed);
    setStep(step + 1);
    window.scrollTo?.({ top: 0 });
  };

  const progress = Math.round((Math.max(0, step) / total) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={() => (step >= 0 ? setConfirmExit(true) : onExit())} className="text-gray-400" aria-label="ストーリーを中断する">
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1">{step < 0 ? story.title : `ステップ ${step + 1}／${total}`}</p>
        </div>
      </div>

      {/* ステップが変わるたびに入力状態を作り直す */}
      <StoryStep key={step} story={story} step={step} onNext={handleNext} />

      {confirmExit && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmExit(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-2xl p-5 shadow-xl">
            <p className="text-lg font-extrabold text-gray-800 mb-1">ストーリーを中断しますか？</p>
            <p className="text-sm text-gray-500 mb-5">このストーリーの進み具合は保存されません。</p>
            <button
              onClick={onExit}
              className="w-full font-extrabold py-3 rounded-2xl border-b-4 bg-red-500 border-red-600 text-white active:translate-y-0.5 active:border-b-2 transition-transform mb-2"
            >
              中断する
            </button>
            <button onClick={() => setConfirmExit(false)} className="w-full font-extrabold py-3 rounded-2xl text-gray-500">
              ストーリーにもどる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Phase = "read" | "fill" | "solved";

function StoryStep({ story, step, onNext }: { story: Story; step: number; onNext: (missed: boolean) => void }) {
  const isIntro = step < 0;
  const isFinale = step === story.steps.length;
  const slots = useMemo(() => (isIntro ? [] : stepSlots(story, step)), [story, step, isIntro]);
  const bank = useMemo(() => ({ id: `${story.id}:${step}`, choices: isIntro ? [] : stepChoices(story, step) }), [story, step, isIntro]);

  const [phase, setPhase] = useState<Phase>("read");
  const [answer, setAnswer] = useState<JournalBlankAnswer>({ slots: {} });
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [tries, setTries] = useState(0);
  const [focus, setFocus] = useState(true); // 穴埋め中は関係する行だけを出す
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  const { tokens, placed, usedIds, tokenById, targetKey, placeToken, handleSlotTap } = useTokenBank(bank, slots, answer, (a: Answer) =>
    setAnswer(a as JournalBlankAnswer),
  );

  // 穴埋めに入ったら、最初の空欄が見える位置までスクロールする
  useEffect(() => {
    if (phase === "fill") document.querySelector("[data-story-slot]")?.scrollIntoView?.({ block: "center" });
  }, [phase]);

  const ready = slots.every((s) => placed[s.key]);
  const handleCheck = () => {
    const wrong = slots.filter((s) => tokenById(placed[s.key])?.label !== s.answer).map((s) => s.key);
    if (wrong.length === 0) {
      setWrongKeys([]);
      setPhase("solved");
      return;
    }
    // 間違えたマスだけ空に戻す。合っているマスはそのまま残す
    const kept = { ...placed };
    for (const k of wrong) delete kept[k];
    setAnswer({ slots: kept });
    setWrongKeys(wrong);
    setTries((n) => n + 1);
  };

  const text = isIntro ? story.intro : isFinale ? "すべての決算整理が終わりました。整理後の金額から、当期純利益を求めましょう。" : story.steps[step].item;
  const explanation = isFinale ? story.finale.explanation : story.steps[step]?.explanation;

  return (
    <>
      <div className="sticky top-0 z-10 bg-white px-4 pb-3">
        <div className="bg-pink-50 border border-pink-100 rounded-2xl px-4 py-3 flex gap-2">
          {isIntro ? <ScrollText className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" /> : !isFinale && <span className="font-extrabold text-pink-500 shrink-0">{step + 1}.</span>}
          <p className="text-sm font-bold text-gray-800 leading-relaxed">{text}</p>
        </div>
      </div>

      <div className="flex-1 px-3 pb-4">
        {phase !== "read" && (
          <button onClick={() => setFocus(!focus)} className="mb-2 text-xs font-extrabold text-sky-500">
            {focus ? "表全体を見る" : isFinale ? "損益計算書の科目だけを見る" : "関係する行だけを見る"}
          </button>
        )}
        <WorksheetTable
          story={story}
          step={step}
          phase={phase}
          focus={focus}
          slots={slots}
          wrongKeys={wrongKeys}
          bank={{ placed, tokenById, targetKey, handleSlotTap }}
        />
      </div>

      <div className={`sticky bottom-0 z-10 px-5 py-4 border-t ${phase === "solved" ? "bg-green-50 border-green-100" : "bg-white border-gray-100"}`}>
        {phase === "read" && (
          <PanelButton onClick={() => (isIntro ? onNext(false) : setPhase("fill"))}>
            {isIntro ? "はじめる" : isFinale ? "当期純利益を求める" : "修正記入を書く"}
          </PanelButton>
        )}

        {phase === "fill" && (
          <>
            <p className={`text-xs font-bold mb-2 ${wrongKeys.length ? "text-red-500" : "text-gray-400"}`} role="status">
              {wrongKeys.length ? "赤いマスがちがいます。もう一度入れてみよう" : "空欄に金額を入れよう（入れたいマスをタップして選べます）"}
            </p>
            {tries >= 2 && <p className="text-xs text-gray-500 mb-2">ヒント：{explanation}</p>}
            <div className="mb-3">
              <TokenBank tokens={tokens} usedIds={usedIds} onPick={placeToken} />
            </div>
            <PanelButton onClick={handleCheck} disabled={!ready}>
              こたえを確認
            </PanelButton>
          </>
        )}

        {phase === "solved" && (
          <>
            <div className="mb-3" role="status">
              <p className="font-extrabold flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                {tries === 0 ? praise : "できた！"}
              </p>
              <p className="text-sm text-gray-500 mt-1">{explanation}</p>
            </div>
            <PanelButton onClick={() => onNext(tries > 0)}>{isFinale ? "ストーリーをおえる" : "つづける"}</PanelButton>
          </>
        )}
      </div>
    </>
  );
}

function PanelButton({ onClick, disabled = false, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full py-3 rounded-2xl font-extrabold border-b-4 transition-transform active:translate-y-0.5 active:border-b-2
        ${disabled ? "bg-gray-200 border-gray-300 text-gray-400" : "bg-green-500 border-green-600 text-white"}
      `}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------
   精算表（試算表・修正記入・整理後の5列）
   修正記入は、前のステップまでの分を記入済みで表示する。
   整理後は、その時点までの修正を反映した金額。損益計算書の科目の行に色を付ける。
--------------------------------------------------------- */

interface BankView {
  placed: Record<string, string>;
  tokenById: (id: string) => { label: string } | undefined;
  targetKey: () => string | null;
  handleSlotTap: (key: string) => void;
}

function WorksheetTable({
  story,
  step,
  phase,
  focus,
  slots,
  wrongKeys,
  bank,
}: {
  story: Story;
  step: number;
  phase: Phase;
  focus: boolean;
  slots: { key: string; answer: string }[];
  wrongKeys: string[];
  bank: BankView;
}) {
  const isFinale = step === story.steps.length;
  const solved = phase === "solved";
  const before = adjustmentsUpTo(story, Math.max(0, step));
  const applied = solved ? adjustmentsUpTo(story, step + 1) : before;
  // 追加の科目は、読んでいる間は出さず、穴埋めに入ったときに表に加える（答えの手がかりにしない）
  const all = visibleAccounts(story, phase === "read" ? step - 1 : step);
  const slotKeys = new Set(phase === "read" ? [] : slots.map((s) => s.key));
  const answerOf = (key: string) => slots.find((s) => s.key === key)?.answer ?? "";
  const touched = (a: StoryAccount) => slotKeys.has(`${a.account}:dr`) || slotKeys.has(`${a.account}:cr`);
  // 空欄が画面外に散らばらないよう、穴埋め中は関係する行（最後は損益計算書の科目）だけを出す
  const rows = phase !== "read" && focus ? all.filter((a) => (isFinale ? a.pl : touched(a))) : all;

  const slotCell = (key: string) => {
    if (solved) return <span className="text-green-600 font-extrabold">{answerOf(key)}</span>;
    const token = bank.placed[key] ? bank.tokenById(bank.placed[key]) : null;
    const wrong = !token && wrongKeys.includes(key);
    const active = !token && bank.targetKey() === key;
    return (
      <button
        data-story-slot
        onClick={() => bank.handleSlotTap(key)}
        aria-label={`空欄 ${key.replace(":dr", " 借方").replace(":cr", " 貸方")}`}
        className={`w-full min-h-8 rounded-md font-extrabold tabular-nums transition-colors
          ${token ? "bg-sky-500 text-white" : "border-2 border-dashed"}
          ${wrong ? "border-red-400 bg-red-50 text-red-300" : ""}
          ${!token && !wrong && active ? "border-sky-400 bg-sky-50 text-gray-300" : ""}
          ${!token && !wrong && !active ? "border-gray-300 text-gray-300" : ""}
        `}
      >
        {token ? token.label : "？"}
      </button>
    );
  };

  const amount = (n: number) => (n ? amountLabel(n) : "");

  return (
    <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
      <table className="w-full table-fixed text-[11px]">
        <colgroup>
          <col className="w-[27%]" />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead className="bg-gray-100 text-gray-500">
          <tr>
            {["勘定科目", "試算表", "修正 借方", "修正 貸方", "整理後"].map((c) => (
              <th key={c} className="px-0.5 py-1.5 font-extrabold border-r last:border-r-0 border-gray-200">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const prev = before.get(a.account) ?? { dr: 0, cr: 0 };
            const highlight = phase !== "read" && touched(a);
            const after = afterAmount(a, applied);
            return (
              <tr key={a.account} className={`border-t border-gray-200 ${highlight ? "bg-sky-50" : a.pl ? "bg-amber-50/70" : ""}`}>
                <td className="px-1 py-1 font-bold text-gray-700 border-r border-gray-200 leading-tight break-words">
                  {a.account}
                  <span className="ml-0.5 text-[9px] text-gray-400">{a.side}</span>
                </td>
                <td className="px-0.5 py-1 text-right text-gray-600 border-r border-gray-200 tabular-nums">{amount(a.tb ?? 0)}</td>
                {(["dr", "cr"] as const).map((col) => {
                  const key = `${a.account}:${col}`;
                  return (
                    <td key={col} className="px-0.5 py-1 text-right text-gray-600 border-r border-gray-200 tabular-nums">
                      {slotKeys.has(key) ? slotCell(key) : amount(prev[col])}
                    </td>
                  );
                })}
                <td className={`px-0.5 py-1 text-right tabular-nums ${solved && highlight ? "text-amber-600 font-extrabold" : "text-gray-700 font-bold"}`}>
                  {amount(after)}
                </td>
              </tr>
            );
          })}
          {isFinale && (
            <tr className="border-t-2 border-gray-300 bg-pink-50">
              <td className="px-1 py-1 font-extrabold text-gray-800 border-r border-gray-200" colSpan={4}>
                {NET_LABEL}
              </td>
              <td className="px-0.5 py-1 text-right tabular-nums">{phase === "read" ? "" : slotCell(NET_KEY)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="px-2 py-1.5 text-[10px] text-gray-400 border-t border-gray-200">
        色のついた行は損益計算書の科目。科目名の横の「借」「貸」は残高が出る側
      </p>
    </div>
  );
}
