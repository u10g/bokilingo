import type { Story, StoryAccount } from "./types.ts";

/* ---------------------------------------------------------
   ストーリーの表の計算
   ステップ i に取り組んでいる間の表は、ステップ 0〜i-1 の修正記入を反映したもの。
   整理後 ＝ 試算表 ＋ 残高と同じ側の修正 − 反対側の修正
--------------------------------------------------------- */

export type StoryCol = "dr" | "cr";

export interface StorySlot {
  key: string; // 「科目:dr」、当期純利益は NET_KEY
  account: string;
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

// ステップの空欄。最後のステップ（steps.length）は当期純利益
export function stepSlots(story: Story, stepIndex: number): StorySlot[] {
  if (stepIndex === story.steps.length) {
    return [{ key: NET_KEY, account: NET_LABEL, col: "after", answer: amountLabel(netIncome(story)) }];
  }
  const step = story.steps[stepIndex];
  if (!step) return [];
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
    for (const e of step.entries) {
      if (!accounts.has(e.account)) errors.push(`${label}: 表にない科目 ${e.account}`);
      usedAccounts.add(e.account);
      for (const col of ["dr", "cr"] as const) {
        if (e[col] === undefined) continue;
        if (e[col]! <= 0) errors.push(`${label}: ${e.account} の金額が正でない`);
        // 同じマスを2回埋めると、前のステップの値と見分けがつかないため1回まで
        const cell = `${e.account}:${col}`;
        if (usedCells.has(cell)) errors.push(`${label}: ${cell} を2回以上使っている`);
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

  for (let i = 0; i <= story.steps.length; i++) {
    const answers = stepSlots(story, i).map((s) => s.answer);
    const distractors = i === story.steps.length ? story.finale.distractors : story.steps[i].distractors;
    for (const d of distractors) if (answers.includes(d)) errors.push(`ステップ${i + 1}: ダミーの選択肢 ${d} が正解と重なっている`);
    if (distractors.length < 2) errors.push(`ステップ${i + 1}: ダミーの選択肢が2つ未満`);
  }
  return errors;
}
