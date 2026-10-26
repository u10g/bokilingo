import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ScrollText, X } from "lucide-react";
import { TokenBank, useTokenBank } from "../components/QuestionRenderer.tsx";
import { PRAISE } from "../domain/constants.ts";
import {
  adjustmentsUpTo,
  afterAmount,
  amountLabel,
  lineAmount,
  lineKey,
  lineSection,
  NET_KEY,
  NET_LABEL,
  stepChoices,
  stepSlots,
  visibleAccounts,
  visibleLines,
  type Adjustments,
  type LineSection,
  type StorySlot,
} from "../domain/story.ts";
import type { Answer, JournalBlankAnswer, LessonResult, Story, StoryAccount, StoryLine } from "../domain/types.ts";

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

const READ_BUTTON: Record<Story["table"], string> = { worksheet: "修正記入を書く", adjustedTb: "残高を書き換える", statements: "財務諸表に反映する" };
const FILL_HINT: Record<Story["table"], string> = { worksheet: "空欄に金額", adjustedTb: "整理後の残高", statements: "金額が変わった行に新しい金額" };

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

  const statements = story.table === "statements";
  const finaleText = statements
    ? "すべての決算整理が終わりました。損益計算書から当期純利益を求め、それを加えた繰越利益剰余金を求めましょう。"
    : "すべての決算整理が終わりました。整理後の金額から、当期純利益を求めましょう。";
  const text = isIntro ? story.intro : isFinale ? finaleText : story.steps[step].item;
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
            {focus ? "表全体を見る" : isFinale && !statements ? "損益計算書の科目だけを見る" : "関係する行だけを見る"}
          </button>
        )}
        <StoryTable
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
            {isIntro ? "はじめる" : isFinale ? "当期純利益を求める" : READ_BUTTON[story.table]}
          </PanelButton>
        )}

        {phase === "fill" && (
          <>
            <p className={`text-xs font-bold mb-2 ${wrongKeys.length ? "text-red-500" : "text-gray-400"}`} role="status">
              {wrongKeys.length
                ? "赤いマスがちがいます。もう一度入れてみよう"
                : `${isFinale ? "空欄に金額" : FILL_HINT[story.table]}を入れよう（入れたいマスをタップして選べます）`}
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
   表の共通部分
   追加の科目は、読んでいる間は出さず、穴埋めに入ったときに表に加える（答えの手がかりにしない）。
   空欄が画面外に散らばらないよう、穴埋め中は関係する行（最後は損益計算書の科目）だけを出す。
--------------------------------------------------------- */

interface BankView {
  placed: Record<string, string>;
  tokenById: (id: string) => { label: string } | undefined;
  targetKey: () => string | null;
  handleSlotTap: (key: string) => void;
}

interface TableProps {
  story: Story;
  step: number;
  phase: Phase;
  focus: boolean;
  slots: StorySlot[];
  wrongKeys: string[];
  bank: BankView;
}

interface TableView {
  rows: StoryAccount[];
  before: Adjustments; // このステップの前までの修正
  applied: Adjustments; // 表に反映している修正（正解後はこのステップを含む）
  slotKeys: Set<string>;
  touched: (a: StoryAccount) => boolean;
  slotCell: (key: string) => ReactNode;
  phase: Phase;
  isFinale: boolean;
  full: boolean; // 表全体を出しているか
}

const amount = (n: number) => (n ? amountLabel(n) : "");

function StoryTable({ story, step, phase, focus, slots, wrongKeys, bank }: TableProps) {
  const isFinale = step === story.steps.length;
  const solved = phase === "solved";
  const before = adjustmentsUpTo(story, Math.max(0, step));
  const applied = solved ? adjustmentsUpTo(story, step + 1) : before;
  const all = visibleAccounts(story, phase === "read" ? step - 1 : step);
  const active = phase === "read" ? [] : slots;
  const slotKeys = new Set(active.map((s) => s.key));
  const touchedAccounts = new Set(active.map((s) => s.account));
  const touched = (a: StoryAccount) => touchedAccounts.has(a.account);
  const full = phase === "read" || !focus;
  const rows = full ? all : all.filter((a) => (isFinale ? a.pl : touched(a)));

  const slotCell = (key: string) => {
    if (solved) return <span className="text-green-600 font-extrabold">{slots.find((s) => s.key === key)?.answer}</span>;
    const token = bank.placed[key] ? bank.tokenById(bank.placed[key]) : null;
    const wrong = !token && wrongKeys.includes(key);
    const current = !token && bank.targetKey() === key;
    return (
      <button
        data-story-slot
        onClick={() => bank.handleSlotTap(key)}
        aria-label={`空欄 ${key.replace(":dr", " 借方").replace(":cr", " 貸方").replace(":after", " 残高").replace("line:", "")}`}
        className={`w-full min-h-8 rounded-md font-extrabold tabular-nums transition-colors
          ${token ? "bg-sky-500 text-white" : "border-2 border-dashed"}
          ${wrong ? "border-red-400 bg-red-50 text-red-300" : ""}
          ${!token && !wrong && current ? "border-sky-400 bg-sky-50 text-gray-300" : ""}
          ${!token && !wrong && !current ? "border-gray-300 text-gray-300" : ""}
        `}
      >
        {token ? token.label : "？"}
      </button>
    );
  };

  if (story.table === "statements") {
    return <StatementsTable story={story} step={step} phase={phase} full={full} applied={applied} slotKeys={slotKeys} touchedLabels={touchedAccounts} slotCell={slotCell} />;
  }
  const view: TableView = { rows, before, applied, slotKeys, touched, slotCell, phase, isFinale, full };
  return story.table === "worksheet" ? <WorksheetTable {...view} /> : <AdjustedTbTable {...view} />;
}

const rowTint = (highlight: boolean, a: StoryAccount) => (highlight ? "bg-sky-50" : a.pl ? "bg-amber-50/70" : "");

/* ---------------------------------------------------------
   精算表（試算表・修正記入・整理後の5列）
   修正記入は、前のステップまでの分を記入済みで表示する。
   整理後は、その時点までの修正を反映した金額。損益計算書の科目の行に色を付ける。
--------------------------------------------------------- */

function WorksheetTable({ rows, before, applied, slotKeys, touched, slotCell, phase, isFinale }: TableView) {
  const solved = phase === "solved";
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
            return (
              <tr key={a.account} className={`border-t border-gray-200 ${rowTint(highlight, a)}`}>
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
                  {amount(afterAmount(a, applied))}
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

/* ---------------------------------------------------------
   決算整理後残高試算表（借方・勘定科目・貸方の3列。本試験と同じ形）
   動いた科目の残高を、その場で整理後の金額に書き換える。
   残高が0になった科目は取り消し線で残し、表から消えたことが分かるようにする。
   表全体を出しているときは合計の行を付ける（貸借が常に一致することを見せる）。
--------------------------------------------------------- */

function AdjustedTbTable({ rows, applied, slotKeys, touched, slotCell, phase, isFinale, full }: TableView) {
  const solved = phase === "solved";
  const total = (side: "借" | "貸") => rows.filter((a) => a.side === side).reduce((t, a) => t + afterAmount(a, applied), 0);

  const cell = (a: StoryAccount, side: "借" | "貸", highlight: boolean) => {
    if (a.side !== side) return null;
    const key = `${a.account}:after`;
    if (slotKeys.has(key)) return slotCell(key);
    return <span className={highlight && solved ? "text-amber-600 font-extrabold" : ""}>{amount(afterAmount(a, applied))}</span>;
  };

  return (
    <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-[30%]" />
          <col />
          <col className="w-[30%]" />
        </colgroup>
        <thead className="bg-gray-100 text-gray-500">
          <tr>
            {["借方", "勘定科目", "貸方"].map((c) => (
              <th key={c} className="px-1 py-1.5 font-extrabold border-r last:border-r-0 border-gray-200">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const highlight = phase !== "read" && touched(a);
            const gone = !highlight && a.tb !== undefined && afterAmount(a, applied) === 0;
            return (
              <tr key={a.account} className={`border-t border-gray-200 ${rowTint(highlight, a)}`}>
                <td className="px-1 py-1 text-right font-bold text-gray-700 border-r border-gray-200 tabular-nums">{cell(a, "借", highlight)}</td>
                <td className={`px-1 py-1 text-center font-bold border-r border-gray-200 leading-tight break-words ${gone ? "line-through text-gray-300" : "text-gray-700"}`}>
                  {a.account}
                </td>
                <td className="px-1 py-1 text-right font-bold text-gray-700 tabular-nums">{cell(a, "貸", highlight)}</td>
              </tr>
            );
          })}
          {full && !isFinale && (
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="px-1 py-1 text-right font-extrabold text-gray-800 border-r border-gray-200 tabular-nums">{amount(total("借"))}</td>
              <td className="px-1 py-1 text-center font-extrabold text-gray-800 border-r border-gray-200">合計</td>
              <td className="px-1 py-1 text-right font-extrabold text-gray-800 tabular-nums">{amount(total("貸"))}</td>
            </tr>
          )}
          {isFinale && (
            <tr className="border-t-2 border-gray-300 bg-pink-50">
              <td className="px-1 py-1 font-extrabold text-gray-800 border-r border-gray-200 text-center" colSpan={2}>
                {NET_LABEL}
              </td>
              <td className="px-1 py-1 text-right tabular-nums">{phase === "read" ? "" : slotCell(NET_KEY)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="px-2 py-1.5 text-[10px] text-gray-400 border-t border-gray-200">
        色のついた行は損益計算書の科目。取り消し線は、残高が0になって試算表から消えた科目
      </p>
    </div>
  );
}

/* ---------------------------------------------------------
   財務諸表（損益計算書・貸借対照表を縦に並べる）
   表示科目ごとに、含まれる科目の整理後の金額を合計して出す。
   貸倒引当金・減価償却累計額は資産の部に△で、仮の科目は0になったら取り消し線で残す。
   最後に、損益計算書の下に当期純利益、貸借対照表に当期純利益を加えた繰越利益剰余金を埋める。
--------------------------------------------------------- */

const STATEMENTS: { title: string; statement: StoryLine["statement"]; sections: LineSection[] }[] = [
  { title: "損益計算書", statement: "PL", sections: ["費用", "収益"] },
  { title: "貸借対照表", statement: "BS", sections: ["資産", "負債・純資産"] },
];

function StatementsTable({
  story,
  step,
  phase,
  full,
  applied,
  slotKeys,
  touchedLabels,
  slotCell,
}: {
  story: Story;
  step: number;
  phase: Phase;
  full: boolean;
  applied: Adjustments;
  slotKeys: Set<string>;
  touchedLabels: Set<string>;
  slotCell: (key: string) => ReactNode;
}) {
  const isFinale = step === story.steps.length;
  const all = visibleLines(story, phase === "read" ? step - 1 : step);
  const shown = (l: StoryLine) => full || touchedLabels.has(l.label) || (isFinale && l.statement === "PL");

  const row = (l: StoryLine) => {
    const highlight = phase !== "read" && touchedLabels.has(l.label);
    const key = lineKey(l);
    const value = lineAmount(story, l, applied);
    const gone = Boolean(l.temp) && value === 0 && !highlight;
    return (
      <tr key={l.label} className={`border-t border-gray-200 ${highlight ? "bg-sky-50" : ""}`}>
        <td className={`py-1 pr-1 font-bold leading-tight break-words border-r border-gray-200 ${l.contra ? "pl-5 text-gray-500" : "pl-2"} ${gone ? "line-through text-gray-300" : "text-gray-700"}`}>
          {l.label}
          {l.temp && !gone && <span className="ml-1 text-[9px] text-gray-400">決算で消える</span>}
        </td>
        <td className="px-1 py-1 text-right font-bold text-gray-700 tabular-nums">
          {slotKeys.has(key) ? slotCell(key) : value ? `${l.contra ? "△ " : ""}${amountLabel(value)}` : ""}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      {STATEMENTS.map(({ title, statement, sections }) => {
        const lines = all.filter((l) => l.statement === statement && shown(l));
        if (lines.length === 0 && !(isFinale && statement === "PL")) return null;
        return (
          <div key={title} className="border-2 border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col />
                <col className="w-[38%]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="px-2 py-1.5 text-left font-extrabold" colSpan={2}>
                    {title}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => {
                  const inSection = lines.filter((l) => lineSection(story, l) === section);
                  if (inSection.length === 0) return null;
                  return [
                    <tr key={section} className="border-t border-gray-200 bg-gray-50">
                      <td className="px-2 py-0.5 text-[10px] font-extrabold text-gray-400" colSpan={2}>
                        {section}
                      </td>
                    </tr>,
                    ...inSection.map(row),
                  ];
                })}
                {statement === "PL" && isFinale && (
                  <tr className="border-t-2 border-gray-300 bg-pink-50">
                    <td className="px-2 py-1 font-extrabold text-gray-800 border-r border-gray-200">{NET_LABEL}</td>
                    <td className="px-1 py-1 text-right tabular-nums">{phase === "read" ? "" : slotCell(NET_KEY)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="px-1 text-[10px] text-gray-400">△は資産から差し引く金額。取り消し線は、決算整理で0になって財務諸表から消えた科目</p>
    </div>
  );
}
