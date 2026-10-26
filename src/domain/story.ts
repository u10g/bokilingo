import type { Story, StoryAccount, StoryLine } from "./types.ts";

/* ---------------------------------------------------------
   ストーリーの表の計算
   ステップ i に取り組んでいる間の表は、ステップ 0〜i-1 の修正記入を反映したもの。
   整理後 ＝ 試算表 ＋ 残高と同じ側の修正 − 反対側の修正

   空欄は表の種類で変わる。
     精算表（worksheet）           … そのステップの修正記入のマス
     決算整理後残高試算表（adjustedTb）… そのステップで動いた科目の、整理後の残高（0になる科目も含む）
     財務諸表（statements）         … そのステップで金額が変わった表示科目の行
   最後に当期純利益を求める。財務諸表では、当期純利益を加えた繰越利益剰余金も求める。
--------------------------------------------------------- */

export type StoryCol = "dr" | "cr";

export interface StorySlot {
  key: string; // 「科目:dr」「科目:after」「line:表示科目」、当期純利益は NET_KEY
  account: string; // 空欄のある行（勘定科目、または財務諸表の表示科目）
  col: StoryCol | "after";
  answer: string;
}

export const NET_KEY = "net";
export const NET_LABEL = "当期純利益";

export const amountLabel = (n: number) => n.toLocaleString("en-US");

export type Adjustments = Map<string, { dr: number; cr: number }>;

// ステップ 0〜upTo-1 の修正記入を、科目ごとに合計する
export function adjustmentsUpTo(story: Story, upTo: number): Adjustments {
  const adj: Adjustments = new Map();
  story.steps.slice(0, Math.max(0, upTo)).forEach((step) =>
    step.entries.forEach((e) => {
      const cur = adj.get(e.account) ?? { dr: 0, cr: 0 };
      adj.set(e.account, { dr: cur.dr + (e.dr ?? 0), cr: cur.cr + (e.cr ?? 0) });
    }),
  );
  return adj;
}

export function afterAmount(a: StoryAccount, adj: Adjustments): number {
  const { dr, cr } = adj.get(a.account) ?? { dr: 0, cr: 0 };
  return (a.tb ?? 0) + (a.side === "借" ? dr - cr : cr - dr);
}

// ステップ stepIndex（イントロは -1）で表に出す行。追加の科目は、最初に使うステップから出す
export function visibleAccounts(story: Story, stepIndex: number): StoryAccount[] {
  const used = new Set(story.steps.slice(0, Math.max(0, stepIndex + 1)).flatMap((s) => s.entries.map((e) => e.account)));
  return story.accounts.filter((a) => a.tb !== undefined || used.has(a.account));
}

// すべての修正を反映した当期純利益（収益 − 費用）
export function netIncome(story: Story): number {
  const adj = adjustmentsUpTo(story, story.steps.length);
  return story.accounts.filter((a) => a.pl).reduce((sum, a) => sum + (a.side === "貸" ? 1 : -1) * afterAmount(a, adj), 0);
}

/* ---------------------------------------------------------
   財務諸表の行
--------------------------------------------------------- */

export const RETAINED_EARNINGS = "繰越利益剰余金";
export const lineKey = (l: StoryLine) => `line:${l.label}`;

// 表示科目の金額 ＝ 含まれる科目の整理後の金額の合計
export function lineAmount(story: Story, line: StoryLine, adj: Adjustments): number {
  return line.accounts.reduce((t, name) => {
    const a = story.accounts.find((x) => x.account === name);
    return t + (a ? afterAmount(a, adj) : 0);
  }, 0);
}

// ステップ stepIndex で表に出す行。含まれる科目のどれかが表に出ていれば出す
export function visibleLines(story: Story, stepIndex: number): StoryLine[] {
  const visible = new Set(visibleAccounts(story, stepIndex).map((a) => a.account));
  return (story.lines ?? []).filter((l) => l.accounts.some((name) => visible.has(name)));
}

export type LineSection = "費用" | "収益" | "資産" | "負債・純資産";

export function lineSection(story: Story, line: StoryLine): LineSection {
  const side = story.accounts.find((a) => a.account === line.accounts[0])?.side ?? "借";
  if (line.statement === "PL") return side === "借" ? "費用" : "収益";
  return line.contra || side === "借" ? "資産" : "負債・純資産";
}

// 繰越利益剰余金の行。最後のステップで、当期純利益を加えた金額を求める
export function retainedEarningsLine(story: Story): StoryLine | undefined {
  return story.lines?.find((l) => l.accounts.includes(RETAINED_EARNINGS));
}

// ステップの空欄。最後のステップ（steps.length）は当期純利益
export function stepSlots(story: Story, stepIndex: number): StorySlot[] {
  if (stepIndex === story.steps.length) {
    const net: StorySlot = { key: NET_KEY, account: NET_LABEL, col: "after", answer: amountLabel(netIncome(story)) };
    const re = story.table === "statements" ? retainedEarningsLine(story) : undefined;
    if (!re) return [net];
    const amount = lineAmount(story, re, adjustmentsUpTo(story, story.steps.length)) + netIncome(story);
    return [net, { key: lineKey(re), account: re.label, col: "after", answer: amountLabel(amount) }];
  }
  const step = story.steps[stepIndex];
  if (!step) return [];
  if (story.table === "statements") {
    const before = adjustmentsUpTo(story, stepIndex);
    const after = adjustmentsUpTo(story, stepIndex + 1);
    return (story.lines ?? [])
      .filter((l) => lineAmount(story, l, before) !== lineAmount(story, l, after))
      .map((l) => ({ key: lineKey(l), account: l.label, col: "after" as const, answer: amountLabel(lineAmount(story, l, after)) }));
  }
  if (story.table === "adjustedTb") {
    const adj = adjustmentsUpTo(story, stepIndex + 1);
    return step.entries.map((e) => {
      const account = story.accounts.find((a) => a.account === e.account);
      return { key: `${e.account}:after`, account: e.account, col: "after" as const, answer: amountLabel(account ? afterAmount(account, adj) : 0) };
    });
  }
  return step.entries.flatMap((e) =>
    (["dr", "cr"] as const).filter((col) => e[col] !== undefined).map((col) => ({ key: `${e.account}:${col}`, account: e.account, col, answer: amountLabel(e[col]!) })),
  );
}

export function stepChoices(story: Story, stepIndex: number): string[] {
  const distractors = stepIndex === story.steps.length ? story.finale.distractors : (story.steps[stepIndex]?.distractors ?? []);
  return [...stepSlots(story, stepIndex).map((s) => s.answer), ...distractors];
}

/* ---------------------------------------------------------
   データの検証（content のテストから呼ぶ）
   問題を書くときの計算ミス・矛盾をここで見つける。
--------------------------------------------------------- */

export function validateStory(story: Story): string[] {
  const errors: string[] = [];
  const accounts = new Map(story.accounts.map((a) => [a.account, a]));
  if (accounts.size !== story.accounts.length) errors.push("科目が重複している");

  const tbSum = (side: "借" | "貸") => story.accounts.filter((a) => a.side === side).reduce((t, a) => t + (a.tb ?? 0), 0);
  if (tbSum("借") !== tbSum("貸")) errors.push(`試算表の借方合計 ${tbSum("借")} と貸方合計 ${tbSum("貸")} が一致しない`);

  const usedCells = new Set<string>();
  const usedAccounts = new Set<string>();
  story.steps.forEach((step, i) => {
    const label = `ステップ${i + 1}`;
    const dr = step.entries.reduce((t, e) => t + (e.dr ?? 0), 0);
    const cr = step.entries.reduce((t, e) => t + (e.cr ?? 0), 0);
    if (dr !== cr || dr === 0) errors.push(`${label}: 修正記入の借方 ${dr} と貸方 ${cr} が一致しない`);
    const names = step.entries.map((e) => e.account);
    if (new Set(names).size !== names.length) errors.push(`${label}: 同じ科目の行が2つある（借方・貸方は1行にまとめる）`);
    for (const e of step.entries) {
      if (!accounts.has(e.account)) errors.push(`${label}: 表にない科目 ${e.account}`);
      usedAccounts.add(e.account);
      for (const col of ["dr", "cr"] as const) {
        if (e[col] === undefined) continue;
        if (e[col]! <= 0) errors.push(`${label}: ${e.account} の金額が正でない`);
        // 精算表では、同じマスを2回埋めると前のステップの値と見分けがつかないため1回まで
        const cell = `${e.account}:${col}`;
        if (usedCells.has(cell) && story.table === "worksheet") errors.push(`${label}: ${cell} を2回以上使っている`);
        usedCells.add(cell);
      }
    }
  });

  const adj = adjustmentsUpTo(story, story.steps.length);
  for (const a of story.accounts) {
    if (a.tb === undefined && !usedAccounts.has(a.account)) errors.push(`${a.account}: 追加の科目なのにどのステップでも使わない`);
    if (afterAmount(a, adj) < 0) errors.push(`${a.account}: 整理後の残高がマイナスになる`);
  }
  // 整理後の残高も貸借が一致する（修正記入が貸借一致なので必ず成り立つが、side の書き間違いを見つける）
  const afterSum = (side: "借" | "貸") => story.accounts.filter((a) => a.side === side).reduce((t, a) => t + afterAmount(a, adj), 0);
  if (afterSum("借") !== afterSum("貸")) errors.push(`整理後の借方合計 ${afterSum("借")} と貸方合計 ${afterSum("貸")} が一致しない（side の誤り）`);

  if (story.table === "statements") errors.push(...validateLines(story, adj));

  for (let i = 0; i <= story.steps.length; i++) {
    const answers = stepSlots(story, i).map((s) => s.answer);
    if (answers.length === 0) errors.push(`ステップ${i + 1}: 空欄がない`);
    const distractors = i === story.steps.length ? story.finale.distractors : story.steps[i].distractors;
    for (const d of distractors) if (answers.includes(d)) errors.push(`ステップ${i + 1}: ダミーの選択肢 ${d} が正解と重なっている`);
    if (distractors.length < 2) errors.push(`ステップ${i + 1}: ダミーの選択肢が2つ未満`);
  }
  return errors;
}

// 財務諸表の行の検証：すべての科目がちょうど1つの行に入り、最後に貸借対照表の貸借が一致する
function validateLines(story: Story, adj: Adjustments): string[] {
  const errors: string[] = [];
  const lines = story.lines ?? [];
  if (lines.length === 0) return ["財務諸表のストーリーに lines がない"];
  const counts = new Map<string, number>();
  for (const l of lines) {
    const sides = new Set(l.accounts.map((name) => story.accounts.find((a) => a.account === name)?.side));
    if (sides.size !== 1 || sides.has(undefined)) errors.push(`${l.label}: 表にない科目か、借・貸の違う科目が混ざっている`);
    const pl = l.accounts.map((name) => Boolean(story.accounts.find((a) => a.account === name)?.pl));
    if (pl.some((x) => x !== (l.statement === "PL"))) errors.push(`${l.label}: 損益計算書と貸借対照表の科目が合っていない`);
    if (l.temp && lineAmount(story, l, adj) !== 0) errors.push(`${l.label}: 仮の科目なのに決算整理後も残高がある`);
    for (const name of l.accounts) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  for (const a of story.accounts) if (counts.get(a.account) !== 1) errors.push(`${a.account}: 財務諸表の行にちょうど1回入っていない`);
  if (!retainedEarningsLine(story)) errors.push("繰越利益剰余金の行がない");

  const total = (section: LineSection) =>
    lines.filter((l) => lineSection(story, l) === section).reduce((t, l) => t + (l.contra ? -1 : 1) * lineAmount(story, l, adj), 0);
  const assets = total("資産");
  const claims = total("負債・純資産") + netIncome(story);
  if (assets !== claims) errors.push(`貸借対照表の資産合計 ${assets} と負債・純資産合計 ${claims} が一致しない`);
  return errors;
}
