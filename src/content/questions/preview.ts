import type { BankEntry } from "../../domain/course.ts";
import type { ClassifyQuestion, Element } from "../../domain/types.ts";
import { ACCOUNTS_NODES } from "../legacy/accounts.ts";

/* ---------------------------------------------------------
   チャプターの予習（5要素分類）
   すべてのセクションを5要素分類のレッスンから始めるため、
   セクションの先頭に来る論点に、そのセクションで使う勘定科目の分類を加える（分類の問題がない・少ない論点）。
   すでに分類の問題がある科目は、旧コースの問題の解説をそのまま使う（IDは別にする）。
--------------------------------------------------------- */

const EXISTING = new Map(
  ACCOUNTS_NODES.flatMap((n) => n.questions)
    .filter((q): q is ClassifyQuestion => q.format === "classify")
    .map((q) => [q.prompt, q] as const),
);

// 旧コースに分類の問題がない科目
const NEW: Record<string, [Element, string]> = {
  建物減価償却累計額: ["資産", "建物の価値の減少額を積み上げた評価勘定で、貸借対照表では建物からマイナスする形で資産の部に表示します。"],
  備品減価償却累計額: ["資産", "備品の価値の減少額を積み上げた評価勘定で、貸借対照表では備品からマイナスする形で資産の部に表示します。"],
  保険料: ["費用", "保険料の支払いは費用です（支払保険料と同じ）。"],
  前払保険料: ["資産", "次期の分を先に払った保険料で、保障を受ける権利なので資産です（前払費用）。"],
  未払利息: ["負債", "当期の利息のうちまだ払っていない分で、支払う義務なので負債です（未払費用）。"],
  前受家賃: ["負債", "次期の分を先に受け取った家賃で、部屋を貸す義務なので負債です（前受収益）。"],
  未収利息: ["資産", "当期の利息のうちまだ受け取っていない分で、受け取る権利なので資産です（未収収益）。"],
  利益準備金: ["純資産", "配当のときに会社法の定めで積み立てる準備金で、純資産です。"],
  未収地代: ["資産", "当期の地代のうちまだ受け取っていない分で、受け取る権利なので資産です（未収収益）。"],
  未払給料: ["負債", "当期の給料のうちまだ払っていない分で、支払う義務なので負債です（未払費用）。"],
};

function preview(topicId: string, accounts: string[]): BankEntry[] {
  return accounts.map((account, i) => {
    const existing = EXISTING.get(account);
    const [answer, explanation] = existing ? [existing.answer, existing.explanation] : (NEW[account] ?? []);
    if (!answer || !explanation) throw new Error(`予習の科目 ${account} の分類がない`);
    const question: ClassifyQuestion = { id: `pv-${topicId}-${i + 1}`, format: "classify", prompt: account, answer, explanation };
    return { topicId, question };
  });
}

export const PREVIEW_QUESTIONS: BankEntry[] = [
  // CHAPTER 07 帳簿（補助簿・商品有高帳）：補助簿に対応する勘定
  ...preview("subledger", ["現金", "当座預金", "売掛金", "買掛金", "受取手形", "支払手形", "仕入", "売上", "繰越商品", "備品"]),
  // CHAPTER 09 伝票
  ...preview("slips", ["現金", "売掛金", "買掛金", "売上", "仕入", "通信費", "旅費交通費", "支払手数料"]),
  // 訂正仕訳（頻度順コースの「第1問 その他」の先頭）
  ...preview("correction", ["現金", "普通預金", "売掛金", "買掛金", "前払金", "前受金", "未収入金", "未払金", "売上", "仕入"]),
  // CHAPTER 10 精算表：決算整理で出てくる勘定
  ...preview("worksheet", ["当座借越", "貯蔵品", "貸倒引当金繰入", "減価償却費", "建物減価償却累計額", "前払保険料", "未払利息", "前受家賃", "未収利息", "未払法人税等"]),
  // CHAPTER 12 財務諸表：表示する科目
  ...preview("statements", ["売上高", "売上原価", "貸倒引当金", "減価償却累計額", "未払法人税等", "法人税、住民税及び事業税", "未払配当金", "資本金", "利益準備金", "繰越利益剰余金"]),
  // 勘定記入（頻度順コースの「第2問 帳簿と財務諸表」の先頭）
  ...preview("ledger-entry", ["保険料", "前払保険料", "支払利息", "未払利息", "受取家賃", "前受家賃", "備品減価償却累計額", "繰越利益剰余金", "利益準備金", "未払配当金"]),
  // 経過勘定①（経過勘定のセクションの先頭）：前払費用などの4分類（旧コースの問題）に、実際に使う勘定科目を加える
  ...preview("accruals-type", ["前払保険料", "未払利息", "前受家賃", "未収地代", "未払給料", "未収利息"]),
  // 減価償却①（減価償却のセクションの先頭）。ほかの科目は旧コースの分類（ac-f2）をこの論点に移している
  ...preview("depreciation-amount", ["建物減価償却累計額"]),
];
