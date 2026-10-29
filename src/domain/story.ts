import { FA_FIELDS, faValues } from "./fixedAssets.ts";
import { cellOrder, inventoryRows, inventorySummary, type InvRow } from "./inventory.ts";
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

/* ---------------------------------------------------------
   勘定記入（ledger）
   ステップごとに、記入する勘定に関係する仕訳を転記する。
   摘要は相手科目。相手科目が複数あるときは、相手科目ごとに行を分ける（未払配当金・利益準備金 など）。
   勘定に関係しない取引（ひっかけ）は記入する行がなく、空欄もない。
   最後に締切の行（次期繰越・損益など）の金額と合計を求める。
--------------------------------------------------------- */

export interface LedgerPosting {
  key: string; // 「p2-0」（ステップ2の1行目）。空欄のキーは「p2-0:n」（摘要）「p2-0:a」（金額）
  side: "dr" | "cr";
  date: string;
  desc: string;
  amount: number;
}

export const CLOSE_KEY = "close:a";
export const TOTAL_KEY = "close:t";

export function ledgerPostings(story: Story, stepIndex: number): LedgerPosting[] {
  const ledger = story.ledger;
  const step = story.steps[stepIndex];
  if (!ledger || !step) return [];
  const own = step.entries.find((e) => e.account === ledger.account);
  if (!own) return [];
  const side = own.dr !== undefined ? "dr" : "cr";
  const other = side === "dr" ? "cr" : "dr";
  const amount = own[side]!;
  const counterparts = step.entries.filter((e) => e.account !== ledger.account && e[other] !== undefined);
  const sameSide = step.entries.filter((e) => e.account !== ledger.account && e[side] !== undefined);
  const row = (desc: string, value: number, k = 0): LedgerPosting => ({ key: `p${stepIndex}-${k}`, side, date: step.date ?? "", desc, amount: value });
  // 相手科目が1つならその科目。相手科目が複数で、この勘定の側がこの勘定だけなら相手科目ごとに分ける。それ以外は諸口
  if (counterparts.length === 1) return [row(counterparts[0].account, amount)];
  if (sameSide.length === 0) return counterparts.map((e, k) => row(e.account, e[other]!, k));
  return [row("諸口", amount)];
}

// 締切の前の、借方・貸方それぞれの合計
export function ledgerSums(story: Story): { dr: number; cr: number } {
  const sums = { dr: 0, cr: 0 };
  const opening = story.ledger?.opening;
  if (opening) sums[story.ledger!.side === "借" ? "dr" : "cr"] += opening.amount;
  story.steps.forEach((_, i) => ledgerPostings(story, i).forEach((p) => (sums[p.side] += p.amount)));
  return sums;
}

// 締切の行（残高と反対側に記入する）と、締め切った後の合計
export function ledgerClosing(story: Story): { side: "dr" | "cr"; amount: number; total: number } {
  const { dr, cr } = ledgerSums(story);
  return dr >= cr ? { side: "cr", amount: dr - cr, total: dr } : { side: "dr", amount: cr - dr, total: cr };
}

/* ---------------------------------------------------------
   商品有高帳（inventory）
   ステップ i で記入するのは、取引 txs[i+1] で増える行（受入・払出・残高）。
   空欄はステップごとに cells で指定する。最後に売上高・売上原価・売上総利益を求める。
--------------------------------------------------------- */

export const SUMMARY_KEYS = [
  { key: "sum:sales", label: "売上高" },
  { key: "sum:cost", label: "売上原価" },
  { key: "sum:gross", label: "売上総利益" },
] as const;

// 取引を n 件目（前月繰越を含めて n+1 件）まで記入したときの全行
export function inventoryRowsUpTo(story: Story, n: number): InvRow[] {
  const inv = story.inventory;
  return inv ? inventoryRows(inv.method, inv.txs.slice(0, n + 1)) : [];
}

// ステップ i で増える行の範囲（全行の中の位置）
export function inventoryStepRange(story: Story, stepIndex: number): { start: number; end: number } {
  return { start: inventoryRowsUpTo(story, stepIndex).length, end: inventoryRowsUpTo(story, stepIndex + 1).length };
}

export const invCellKey = (row: number, col: string) => `inv:${row}:${col}`;

function inventorySlots(story: Story, stepIndex: number): StorySlot[] {
  const inv = story.inventory;
  if (!inv) return [];
  if (stepIndex === story.steps.length) {
    const { sales, cost } = inventorySummary(inv.method, inv.txs);
    const values = [sales, cost, sales - cost];
    return SUMMARY_KEYS.map((k, i) => ({ key: k.key, account: k.label, col: "after" as const, answer: amountLabel(values[i]) }));
  }
  const rows = inventoryRowsUpTo(story, stepIndex + 1);
  const { start } = inventoryStepRange(story, stepIndex);
  const stepRows = rows.slice(start);
  const picked = new Map<number, string[]>();
  for (const [section, col, nth = 0] of story.steps[stepIndex]?.cells ?? []) {
    const hits = stepRows.map((r, i) => [r, start + i] as const).filter(([r]) => r.section === section);
    const hit = hits[nth];
    if (!hit) throw new Error(`${story.id} ステップ${stepIndex + 1}: ${section}の${nth + 1}行目がない`);
    picked.set(hit[1], [...(picked.get(hit[1]) ?? []), col]);
  }
  // 行の順に、行の中は入力の順番（移動平均法の残高は数量 → 金額 → 単価）で並べる
  return [...picked.keys()]
    .sort((a, b) => a - b)
    .flatMap((ri) =>
      cellOrder(inv.method, rows[ri])
        .filter((c) => picked.get(ri)!.includes(c))
        .map((c) => ({ key: invCellKey(ri, c), account: `inv:${ri}`, col: "after" as const, answer: amountLabel(rows[ri][c]) })),
    );
}

/* ---------------------------------------------------------
   固定資産台帳（fixedAssets）
   ステップ i で、資産 assets[i] の列（期首減価償却累計額・当期減価償却費・期末帳簿価額）を記入する。
   空欄はステップごとに faCells で指定する。最後に、当期の減価償却費の合計と、期末の減価償却累計額の合計を求める。
   この2つは、本試験で台帳のあとに問われる減価償却費勘定と減価償却累計額勘定の金額になる。
--------------------------------------------------------- */

export const faCellKey = (asset: number, field: string) => `fa:${asset}:${field}`;
export const FA_SUM_DEP = "fa:sum:dep";
export const FA_SUM_ACC = "fa:sum:acc";

// 最後に求める2つの金額と、その行の名前
export function faTotals(story: Story): { key: string; label: string; amount: number }[] {
  const fa = story.fixedAssets;
  if (!fa) return [];
  const values = fa.assets.map((a) => faValues(fa.period, a));
  return [
    { key: FA_SUM_DEP, label: "減価償却費（当期）", amount: values.reduce((t, v) => t + v.dep, 0) },
    { key: FA_SUM_ACC, label: `${fa.kind}減価償却累計額（期末）`, amount: values.reduce((t, v) => t + v.acc + v.dep, 0) },
  ];
}

function fixedAssetSlots(story: Story, stepIndex: number): StorySlot[] {
  const fa = story.fixedAssets;
  if (!fa) return [];
  if (stepIndex === story.steps.length) return faTotals(story).map((x) => ({ key: x.key, account: x.label, col: "after" as const, answer: amountLabel(x.amount) }));
  const asset = fa.assets[stepIndex];
  if (!asset) return [];
  const values = faValues(fa.period, asset);
  const cells = story.steps[stepIndex]?.faCells ?? [];
  // 期首に累計額がない（当期に取得した）ときは「0」と書く
  return FA_FIELDS.filter((f) => cells.includes(f)).map((f) => ({ key: faCellKey(stepIndex, f), account: `fa:${stepIndex}`, col: "after" as const, answer: amountLabel(values[f]) }));
}

// ステップの空欄。最後のステップ（steps.length）は当期純利益
export function stepSlots(story: Story, stepIndex: number): StorySlot[] {
  if (story.table === "inventory") return inventorySlots(story, stepIndex);
  if (story.table === "fixedAssets") return fixedAssetSlots(story, stepIndex);
  if (story.table === "ledger") {
    if (stepIndex === story.steps.length) {
      const c = ledgerClosing(story);
      return [
        { key: CLOSE_KEY, account: story.ledger?.closing.desc ?? "", col: "after", answer: amountLabel(c.amount) },
        { key: TOTAL_KEY, account: "合計", col: "after", answer: amountLabel(c.total) },
      ];
    }
    return ledgerPostings(story, stepIndex).flatMap((p) => [
      { key: `${p.key}:n`, account: p.key, col: "after" as const, answer: p.desc },
      { key: `${p.key}:a`, account: p.key, col: "after" as const, answer: amountLabel(p.amount) },
    ]);
  }
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
  if (story.table === "ledger") return validateLedger(story);
  if (story.table === "inventory") return validateInventory(story);
  if (story.table === "fixedAssets") return validateFixedAssets(story);
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

// 勘定記入のストーリーの検証：各取引の仕訳が貸借一致し、勘定には1つの側だけに記入する。締切の金額は正
function validateLedger(story: Story): string[] {
  const errors: string[] = [];
  const ledger = story.ledger;
  if (!ledger) return ["勘定記入のストーリーに ledger がない"];
  story.steps.forEach((step, i) => {
    const label = `ステップ${i + 1}`;
    const dr = step.entries.reduce((t, e) => t + (e.dr ?? 0), 0);
    const cr = step.entries.reduce((t, e) => t + (e.cr ?? 0), 0);
    if (dr !== cr || dr === 0) errors.push(`${label}: 仕訳の借方 ${dr} と貸方 ${cr} が一致しない`);
    const own = step.entries.filter((e) => e.account === ledger.account);
    if (own.length > 1 || own.some((e) => e.dr !== undefined && e.cr !== undefined)) errors.push(`${label}: 勘定の借方と貸方の両方に記入している`);
    if (own.length && !step.date) errors.push(`${label}: 勘定に記入するのに日付がない`);
  });
  const c = ledgerClosing(story);
  if (c.amount <= 0) errors.push("締切の金額が0以下");
  const expected = ledger.side === "借" ? "cr" : "dr";
  if (c.side !== expected && c.amount > 0) errors.push(`残高が${ledger.side}方に出ない（締切の行の側が逆）`);

  for (let i = 0; i <= story.steps.length; i++) {
    const answers = stepSlots(story, i).map((s) => s.answer);
    const distractors = i === story.steps.length ? story.finale.distractors : story.steps[i].distractors;
    // 勘定に関係しない取引には空欄がないので、ダミーも要らない
    if (answers.length === 0) continue;
    for (const d of distractors) if (answers.includes(d)) errors.push(`ステップ${i + 1}: ダミーの選択肢 ${d} が正解と重なっている`);
    if (distractors.length < 2) errors.push(`ステップ${i + 1}: ダミーの選択肢が2つ未満`);
  }
  return errors;
}

// 商品有高帳のストーリーの検証：取引の数とステップの数、帳簿の計算（割り切れるか・在庫が足りるか）、空欄の指定
function validateInventory(story: Story): string[] {
  const inv = story.inventory;
  if (!inv) return ["商品有高帳のストーリーに inventory がない"];
  const errors: string[] = [];
  if (inv.txs[0]?.[1] !== "前月繰越") errors.push("最初の取引が前月繰越でない");
  if (inv.txs.length !== story.steps.length + 1) errors.push(`取引 ${inv.txs.length - 1} 件とステップ ${story.steps.length} 件が合わない`);
  try {
    inventoryRows(inv.method, inv.txs);
  } catch (e) {
    return [...errors, `帳簿が計算できない：${(e as Error).message}`];
  }
  const { sales, cost } = inventorySummary(inv.method, inv.txs);
  if (sales - cost <= 0) errors.push("売上総利益が0以下");
  for (let i = 0; i <= story.steps.length; i++) {
    const label = `ステップ${i + 1}`;
    let slots: StorySlot[];
    try {
      slots = stepSlots(story, i);
    } catch (e) {
      errors.push((e as Error).message);
      continue;
    }
    if (slots.length === 0) errors.push(`${label}: 空欄がない`);
    if (new Set(slots.map((x) => x.key)).size !== slots.length) errors.push(`${label}: 同じセルを2回空欄にしている`);
    const answers = slots.map((x) => x.answer);
    const distractors = i === story.steps.length ? story.finale.distractors : story.steps[i].distractors;
    for (const d of distractors) if (answers.includes(d)) errors.push(`${label}: ダミーの選択肢 ${d} が正解と重なっている`);
    if (distractors.length < 2) errors.push(`${label}: ダミーの選択肢が2つ未満`);
  }
  return errors;
}

// 固定資産台帳のストーリーの検証：資産の数とステップの数、台帳の計算（割り切れるか・耐用年数内か）、空欄の指定
function validateFixedAssets(story: Story): string[] {
  const fa = story.fixedAssets;
  if (!fa) return ["固定資産台帳のストーリーに fixedAssets がない"];
  const errors: string[] = [];
  if (fa.assets.length !== story.steps.length) errors.push(`資産 ${fa.assets.length} 件とステップ ${story.steps.length} 件が合わない`);
  for (const a of fa.assets) {
    try {
      faValues(fa.period, a);
    } catch (e) {
      errors.push(`台帳が計算できない：${(e as Error).message}`);
    }
  }
  if (errors.length) return errors;
  for (let i = 0; i <= story.steps.length; i++) {
    const label = `ステップ${i + 1}`;
    const cells = story.steps[i]?.faCells ?? [];
    if (new Set(cells).size !== cells.length) errors.push(`${label}: 同じ行を2回空欄にしている`);
    const answers = stepSlots(story, i).map((x) => x.answer);
    if (answers.length === 0) errors.push(`${label}: 空欄がない`);
    const distractors = i === story.steps.length ? story.finale.distractors : story.steps[i].distractors;
    for (const d of distractors) if (answers.includes(d)) errors.push(`${label}: ダミーの選択肢 ${d} が正解と重なっている`);
    if (distractors.length < 2) errors.push(`${label}: ダミーの選択肢が2つ未満`);
  }
  return errors;
}
