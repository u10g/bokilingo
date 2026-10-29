/* ---------------------------------------------------------
   固定資産台帳の計算（問題とストーリーで共通）
   減価償却は残存価額ゼロの定額法、期中に取得したものは月割。
--------------------------------------------------------- */

export interface FaAsset {
  name: string;
  acquired: [year: number, month: number]; // ×年・月（1日に取得）
  life: number; // 耐用年数
  cost: number; // 取得原価
}
// 期首減価償却累計額・当期減価償却費・期末帳簿価額
export type FaField = "acc" | "dep" | "book";

// 台帳の行（本試験の列）。資産ごとに1列にして、行と列を入れ替えて表示する
export const FA_ROWS = ["取得年月日", "耐用年数", "取得原価", "期首減価償却累計額", "当期減価償却費", "期末帳簿価額"] as const;
export const FA_FIELD_ROW: Record<FaField, number> = { acc: 3, dep: 4, book: 5 };
// 入力の順番：期首累計額 → 当期の償却費 → 期末帳簿価額（帳簿価額は前の2つから求める）
export const FA_FIELDS: FaField[] = ["acc", "dep", "book"];

export const faAcquiredLabel = (a: FaAsset) => `×${a.acquired[0]}年${a.acquired[1]}月1日`;

// 会計期間の月の通し番号（4月始まり）。×5年4月 → 5*12+0、×6年3月 → 5*12+11
const fiscalMonth = (year: number, month: number) => (month >= 4 ? year * 12 + (month - 4) : (year - 1) * 12 + (month + 8));

// period は当期の期首の年（×5年4月1日〜×6年3月31日なら 5）
export function faValues(period: number, a: FaAsset): Record<FaField, number> {
  if (a.cost % a.life !== 0) throw new Error(`${a.name}: 1年分の減価償却費 ${a.cost}÷${a.life} が割り切れない`);
  const annual = a.cost / a.life;
  const start = period * 12; // 当期の期首（4月）
  const got = fiscalMonth(...a.acquired);
  if (got > start + 11) throw new Error(`${a.name}: 当期より後に取得している`);
  const before = Math.max(0, start - got); // 期首までに使った月数
  const during = Math.min(12, start + 12 - Math.max(got, start)); // 当期に使った月数
  if ((annual * before) % 12 !== 0 || (annual * during) % 12 !== 0) throw new Error(`${a.name}: 月割の金額が割り切れない`);
  const acc = (annual * before) / 12;
  const dep = (annual * during) / 12;
  if (acc + dep > a.cost) throw new Error(`${a.name}: 耐用年数を過ぎている`);
  return { acc, dep, book: a.cost - acc - dep };
}
