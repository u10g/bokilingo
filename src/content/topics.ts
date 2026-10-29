import type { TopicDef } from "../domain/course.ts";

/* ---------------------------------------------------------
   論点マスタ（2022年度適用 出題区分表の3級範囲）
   旧コースの「場面別の章立て」を小項目に分けたものに、
   参考書の分析（docs/topic-map.md）で見つかった論点を加えている。
--------------------------------------------------------- */

const list: TopicDef[] = [
  { id: "sales-basic", title: "商品売買の基本", desc: "三分法と掛け取引です。" },
  { id: "sales-extra", title: "前払い・返品・諸掛り", desc: "内金、返品、運賃、クレジット売掛金です。" },
  { id: "cash-deposit", title: "現金と預金", desc: "現金・当座預金・普通預金の動きです。" },
  { id: "cash-short", title: "現金過不足と小口現金", desc: "帳簿と実際の差額や、小口の支払いです。" },
  { id: "notes", title: "手形と電子記録債権・債務", desc: "約束手形と電子記録債権・債務です。" },
  { id: "loans", title: "貸し借りと商品以外の売買", desc: "貸付金・借入金と、未収入金・未払金です。" },
  { id: "payroll", title: "給料と預り金", desc: "給料の支払いと源泉徴収・社会保険料です。" },
  { id: "suspense", title: "仮払金と仮受金", desc: "内容や金額が未確定のお金です。" },
  { id: "expenses", title: "経費の支払い", desc: "通信費・水道光熱費などの経費です。" },
  { id: "rent", title: "土地・建物の賃借", desc: "家賃・地代と敷金です。" },
  { id: "services", title: "サービスのやりとり", desc: "手数料・保険料・利息・商品券です。" },
  { id: "fixed-assets", title: "固定資産の購入と売却", desc: "建物・備品・土地の取得と売却です。" },
  { id: "depreciation-amount", title: "減価償却① 年額", desc: "定額法で、1年分の減価償却費を計算します。" },
  { id: "depreciation-monthly", title: "減価償却② 月割", desc: "期中に取得した固定資産の、当期分の月数と金額です。" },
  { id: "depreciation-entry", title: "減価償却③ 間接法の仕訳", desc: "減価償却費と減価償却累計額で記帳します。" },
  { id: "depreciation-sale", title: "減価償却④ 帳簿価額と売却", desc: "帳簿価額を求め、売却損益を判断します。" },
  { id: "depreciation-midyear", title: "減価償却⑤ 期中売却", desc: "当期分の減価償却費を月割で計上してから売却します。" },
  { id: "bad-debts-amount", title: "貸倒引当金① 設定額", desc: "売掛金などの期末残高に設定率をかけて、設定額を求めます。" },
  { id: "bad-debts-refill", title: "貸倒引当金② 差額補充法", desc: "設定額と残高の差額から、繰入か戻入かと金額を求めます。" },
  { id: "bad-debts-entry", title: "貸倒引当金③ 決算整理仕訳", desc: "貸倒引当金繰入・貸倒引当金戻入の仕訳です。" },
  { id: "bad-debts-writeoff", title: "貸倒引当金④ 貸倒れの処理", desc: "いつ販売した債権かで、貸倒引当金を使うか貸倒損失にするかを判断します。" },
  { id: "bad-debts-recovery", title: "貸倒引当金⑤ 償却債権取立益", desc: "前期以前に貸倒れとした債権を回収したときの処理です。" },
  { id: "accruals-type", title: "経過勘定① 4つの分類", desc: "前払費用・前受収益・未払費用・未収収益のどれかを判断します。" },
  { id: "accruals-account", title: "経過勘定② 勘定科目", desc: "前払保険料・未払利息など、計上する勘定科目です。" },
  { id: "accruals-months", title: "経過勘定③ 月数と金額", desc: "支払日・受取日から決算日までの月数を数えて月割します。" },
  { id: "accruals-entry", title: "経過勘定④ 決算整理仕訳", desc: "決算で経過勘定を計上する仕訳です。" },
  { id: "accruals-reversal", title: "経過勘定⑤ 再振替", desc: "期首に、経過勘定を元の勘定へ戻す仕訳です。" },
  { id: "closing", title: "売上原価と決算の振替", desc: "売上原価の算定と、決算での振替です。" },
  { id: "consumption-tax", title: "消費税", desc: "仮払消費税・仮受消費税の処理です。" },
  { id: "corporate-tax", title: "法人税等", desc: "法人税・住民税及び事業税の処理です。" },
  { id: "equity", title: "株式の発行と配当", desc: "資本金と、繰越利益剰余金の配当です。" },
  { id: "correction", title: "訂正仕訳", desc: "誤った仕訳を正しい仕訳に直します。" },
  { id: "slips", title: "伝票", desc: "入金伝票・出金伝票・振替伝票の3伝票制です。" },
  { id: "subledger", title: "補助簿", desc: "取引を記入する補助簿の選び方です。" },
  { id: "inventory-ledger", title: "商品有高帳", desc: "移動平均法・先入先出法による記入です。" },
  { id: "fixed-asset-register", title: "固定資産台帳", desc: "資産ごとの期首累計額・当期の減価償却費・帳簿価額です。" },
  { id: "statements", title: "財務諸表のしくみ", desc: "貸借対照表・損益計算書と、利益の計算です。" },
  { id: "worksheet", title: "精算表", desc: "決算整理事項ごとに、修正記入と整理後の金額を求めます。" },
  { id: "ledger-entry", title: "勘定記入", desc: "勘定に日付・摘要・金額を記入し、締め切ります。" },
  { id: "fs-preparation", title: "財務諸表の作成", desc: "決算整理後の金額を、貸借対照表・損益計算書に表示します。" },
  { id: "terms", title: "簿記の用語", desc: "帳簿・伝票・決算の用語を、文の空欄に入れます。" },
];

export const TOPICS: Record<string, TopicDef> = Object.fromEntries(list.map((t) => [t.id, t]));

/* ---------------------------------------------------------
   本試験の分析で使う論点のまとまり
   減価償却・経過勘定・貸倒引当金はアプリでは要素ごとの小項目に分けているが、
   参考書の集計（tools/pdf・docs/data/tags.csv）では1つの論点として数える。
   tools/pdf はこのファイルの { id, title } を読むので、ここにも同じ形で書いておく。
--------------------------------------------------------- */

export const ANALYSIS_TOPICS: TopicDef[] = [
  { id: "depreciation", title: "減価償却", desc: "depreciation-* の小項目をまとめたもの。" },
  { id: "accruals", title: "経過勘定", desc: "accruals-* の小項目をまとめたもの。" },
  { id: "bad-debts", title: "貸倒れと貸倒引当金", desc: "bad-debts-* の小項目をまとめたもの。" },
];
