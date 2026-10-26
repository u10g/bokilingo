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
  { id: "depreciation", title: "減価償却", desc: "固定資産の価値の減少を費用にします。" },
  { id: "bad-debts", title: "貸倒れと貸倒引当金", desc: "回収できない債権への備えです。" },
  { id: "accruals", title: "経過勘定", desc: "費用・収益の前払い・前受け・未払い・未収です。" },
  { id: "closing", title: "売上原価と決算の振替", desc: "売上原価の算定と、決算での振替です。" },
  { id: "consumption-tax", title: "消費税", desc: "仮払消費税・仮受消費税の処理です。" },
  { id: "corporate-tax", title: "法人税等", desc: "法人税・住民税及び事業税の処理です。" },
  { id: "equity", title: "株式の発行と配当", desc: "資本金と、繰越利益剰余金の配当です。" },
  { id: "correction", title: "訂正仕訳", desc: "誤った仕訳を正しい仕訳に直します。" },
  { id: "slips", title: "伝票", desc: "入金伝票・出金伝票・振替伝票の3伝票制です。" },
  { id: "subledger", title: "補助簿", desc: "取引を記入する補助簿の選び方です。" },
  { id: "inventory-ledger", title: "商品有高帳", desc: "移動平均法・先入先出法による記入です。" },
  { id: "statements", title: "財務諸表のしくみ", desc: "貸借対照表・損益計算書と、利益の計算です。" },
  { id: "worksheet", title: "精算表", desc: "決算整理事項ごとに、修正記入と整理後の金額を求めます。" },
  { id: "ledger-entry", title: "勘定記入", desc: "勘定に日付・摘要・金額を記入し、締め切ります。" },
  { id: "fs-preparation", title: "財務諸表の作成", desc: "決算整理後の金額を、貸借対照表・損益計算書に表示します。" },
];

export const TOPICS: Record<string, TopicDef> = Object.fromEntries(list.map((t) => [t.id, t]));
