import type { Story } from "../../domain/types.ts";

/* ---------------------------------------------------------
   財務諸表ストーリー
   決算整理事項を1つずつ反映し、損益計算書と貸借対照表の表示科目の金額を埋めていく。
   財務諸表に特有の表示（売上原価・商品・前払費用・未払費用・前受収益、
   貸倒引当金と減価償却累計額の△表示）を、科目が書き換わる流れの中で学ぶ。
   最後に当期純利益と、それを加えた繰越利益剰余金を求める。
   会計期間は4月1日〜3月31日。数値はすべてオリジナル。
--------------------------------------------------------- */

export const STATEMENTS_STORY: Story = {
  id: "story-fs-1",
  topicId: "fs-preparation",
  table: "statements",
  title: "財務諸表ストーリー",
  intro:
    "ミカン商事の決算日（3月31日）です。決算整理前の残高試算表の金額で、損益計算書と貸借対照表の下書きができています。決算整理事項を1つずつ反映して、財務諸表を完成させましょう。",
  accounts: [
    // 決算整理前残高試算表
    { account: "現金", side: "借", tb: 120000 },
    { account: "当座預金", side: "借", tb: 350000 },
    { account: "売掛金", side: "借", tb: 400000 },
    { account: "繰越商品", side: "借", tb: 90000 },
    { account: "仮払金", side: "借", tb: 20000 },
    { account: "仮払消費税", side: "借", tb: 40000 },
    { account: "仮払法人税等", side: "借", tb: 10000 },
    { account: "備品", side: "借", tb: 500000 },
    { account: "買掛金", side: "貸", tb: 250000 },
    { account: "借入金", side: "貸", tb: 300000 },
    { account: "仮受消費税", side: "貸", tb: 90000 },
    { account: "貸倒引当金", side: "貸", tb: 3000 },
    { account: "備品減価償却累計額", side: "貸", tb: 100000 },
    { account: "資本金", side: "貸", tb: 400000 },
    { account: "繰越利益剰余金", side: "貸", tb: 98000 },
    { account: "売上", side: "貸", tb: 1300000, pl: true },
    { account: "受取家賃", side: "貸", tb: 48000, pl: true },
    { account: "仕入", side: "借", tb: 700000, pl: true },
    { account: "給料", side: "借", tb: 200000, pl: true },
    { account: "保険料", side: "借", tb: 36000, pl: true },
    { account: "支払家賃", side: "借", tb: 120000, pl: true },
    { account: "支払利息", side: "借", tb: 3000, pl: true },
    // 決算整理で追加する科目
    { account: "旅費交通費", side: "借", pl: true },
    { account: "貸倒引当金繰入", side: "借", pl: true },
    { account: "減価償却費", side: "借", pl: true },
    { account: "未払消費税", side: "貸" },
    { account: "前払保険料", side: "借" },
    { account: "前払家賃", side: "借" },
    { account: "未払利息", side: "貸" },
    { account: "前受家賃", side: "貸" },
    { account: "法人税、住民税及び事業税", side: "借", pl: true },
    { account: "未払法人税等", side: "貸" },
  ],
  lines: [
    // 損益計算書
    { label: "売上原価", statement: "PL", accounts: ["仕入"] },
    { label: "給料", statement: "PL", accounts: ["給料"] },
    { label: "保険料", statement: "PL", accounts: ["保険料"] },
    { label: "支払家賃", statement: "PL", accounts: ["支払家賃"] },
    { label: "旅費交通費", statement: "PL", accounts: ["旅費交通費"] },
    { label: "貸倒引当金繰入", statement: "PL", accounts: ["貸倒引当金繰入"] },
    { label: "減価償却費", statement: "PL", accounts: ["減価償却費"] },
    { label: "支払利息", statement: "PL", accounts: ["支払利息"] },
    { label: "法人税、住民税及び事業税", statement: "PL", accounts: ["法人税、住民税及び事業税"] },
    { label: "売上高", statement: "PL", accounts: ["売上"] },
    { label: "受取家賃", statement: "PL", accounts: ["受取家賃"] },
    // 貸借対照表（資産の部）
    { label: "現金", statement: "BS", accounts: ["現金"] },
    { label: "当座預金", statement: "BS", accounts: ["当座預金"] },
    { label: "売掛金", statement: "BS", accounts: ["売掛金"] },
    { label: "貸倒引当金", statement: "BS", accounts: ["貸倒引当金"], contra: true },
    { label: "商品", statement: "BS", accounts: ["繰越商品"] },
    { label: "前払費用", statement: "BS", accounts: ["前払保険料", "前払家賃"] },
    { label: "備品", statement: "BS", accounts: ["備品"] },
    { label: "減価償却累計額", statement: "BS", accounts: ["備品減価償却累計額"], contra: true },
    { label: "仮払金", statement: "BS", accounts: ["仮払金"], temp: true },
    { label: "仮払消費税", statement: "BS", accounts: ["仮払消費税"], temp: true },
    { label: "仮払法人税等", statement: "BS", accounts: ["仮払法人税等"], temp: true },
    // 貸借対照表（負債・純資産の部）
    { label: "買掛金", statement: "BS", accounts: ["買掛金"] },
    { label: "借入金", statement: "BS", accounts: ["借入金"] },
    { label: "未払消費税", statement: "BS", accounts: ["未払消費税"] },
    { label: "未払費用", statement: "BS", accounts: ["未払利息"] },
    { label: "前受収益", statement: "BS", accounts: ["前受家賃"] },
    { label: "未払法人税等", statement: "BS", accounts: ["未払法人税等"] },
    { label: "仮受消費税", statement: "BS", accounts: ["仮受消費税"], temp: true },
    { label: "資本金", statement: "BS", accounts: ["資本金"] },
    { label: "繰越利益剰余金", statement: "BS", accounts: ["繰越利益剰余金"] },
  ],
  steps: [
    {
      item: "仮払金20,000円は、従業員の出張旅費の概算払いである。従業員が帰社し、全額を旅費として使ったと報告を受けたが、未処理である。",
      entries: [
        { account: "仮払金", cr: 20000 },
        { account: "旅費交通費", dr: 20000 },
      ],
      distractors: ["40,000", "10,000"],
      explanation: "仮払金は0になり、財務諸表には出ません。使った20,000円は旅費交通費として損益計算書に載ります。",
    },
    {
      item: "売掛金の期末残高に対して2%の貸倒引当金を、差額補充法で設定する。",
      entries: [
        { account: "貸倒引当金", cr: 5000 },
        { account: "貸倒引当金繰入", dr: 5000 },
      ],
      distractors: ["3,000", "11,000"],
      explanation: "400,000×2%＝8,000円が貸倒引当金で、貸借対照表では売掛金の下に△8,000と差し引いて表示します。繰入はすでにある3,000円との差額の5,000円です。",
    },
    {
      item: "期末商品棚卸高は110,000円である。",
      entries: [
        { account: "繰越商品", dr: 110000, cr: 90000 },
        { account: "仕入", dr: 90000, cr: 110000 },
      ],
      distractors: ["90,000", "700,000"],
      explanation: "財務諸表では、繰越商品は「商品」、仕入は「売上原価」と表示します。商品は期末の110,000円、売上原価は700,000＋90,000−110,000＝680,000円です。",
    },
    {
      item: "備品について、耐用年数5年・残存価額ゼロの定額法で減価償却を行う。",
      entries: [
        { account: "備品減価償却累計額", cr: 100000 },
        { account: "減価償却費", dr: 100000 },
      ],
      distractors: ["300,000", "50,000"],
      explanation: "500,000÷5年＝100,000円。減価償却累計額は100,000＋100,000＝200,000円になり、貸借対照表では備品の下に△200,000と表示します。",
    },
    {
      item: "消費税の処理（税抜方式）を行う。",
      entries: [
        { account: "仮払消費税", cr: 40000 },
        { account: "仮受消費税", dr: 90000 },
        { account: "未払消費税", cr: 50000 },
      ],
      distractors: ["130,000", "40,000"],
      explanation: "仮払消費税と仮受消費税は相殺して0になり、財務諸表から消えます。差額の90,000−40,000＝50,000円が未払消費税（負債）です。",
    },
    {
      item: "保険料36,000円は、12月1日に向こう1年分を支払ったものである。未経過分を月割で繰り延べる。",
      entries: [
        { account: "保険料", cr: 24000 },
        { account: "前払保険料", dr: 24000 },
      ],
      distractors: ["36,000", "9,000"],
      explanation: "4月〜11月の8か月分（36,000×8/12＝24,000円）は次期の費用です。前払保険料は、貸借対照表では「前払費用」と表示します。保険料は12,000円になります。",
    },
    {
      item: "支払家賃のうち30,000円は、3月1日に3月〜5月の3か月分を支払ったものである。前払分を月割で繰り延べる。",
      entries: [
        { account: "支払家賃", cr: 20000 },
        { account: "前払家賃", dr: 20000 },
      ],
      distractors: ["20,000", "110,000"],
      explanation: "4月・5月の2か月分（30,000×2/3＝20,000円）が前払家賃です。前払費用は前払保険料と合わせて24,000＋20,000＝44,000円、支払家賃は100,000円になります。",
    },
    {
      item: "借入金300,000円は、1月1日に年利率2%で借り入れたものである（利息は返済時に支払う）。利息を月割で見越し計上する。",
      entries: [
        { account: "支払利息", dr: 1500 },
        { account: "未払利息", cr: 1500 },
      ],
      distractors: ["6,000", "3,000"],
      explanation: "1月〜3月の3か月分、300,000×2%×3/12＝1,500円は当期の費用です。未払利息は「未払費用」と表示します。支払利息は3,000＋1,500＝4,500円です。",
    },
    {
      item: "受取家賃のうち12,000円は、3月1日に3月〜5月の3か月分を受け取ったものである。前受分を月割で繰り延べる。",
      entries: [
        { account: "受取家賃", dr: 8000 },
        { account: "前受家賃", cr: 8000 },
      ],
      distractors: ["4,000", "44,000"],
      explanation: "4月・5月の2か月分（12,000×2/3＝8,000円）は次期の収益です。前受家賃は「前受収益」と表示します。受取家賃は40,000円になります。",
    },
    {
      item: "法人税、住民税及び事業税65,000円を計上する。中間納付額は仮払法人税等で処理している。",
      entries: [
        { account: "仮払法人税等", cr: 10000 },
        { account: "法人税、住民税及び事業税", dr: 65000 },
        { account: "未払法人税等", cr: 55000 },
      ],
      distractors: ["75,000", "10,000"],
      explanation: "仮払法人税等は0になって消えます。65,000円から中間納付の10,000円を引いた55,000円が未払法人税等です。",
    },
  ],
  finale: {
    distractors: ["218,500", "120,500", "316,500"],
    explanation:
      "収益1,340,000円から費用1,186,500円を引いて、当期純利益は153,500円です。当期純利益は繰越利益剰余金に加わるので、貸借対照表の繰越利益剰余金は98,000＋153,500＝251,500円。これで資産合計と負債・純資産合計がどちらも1,316,000円で一致します。",
  },
};
