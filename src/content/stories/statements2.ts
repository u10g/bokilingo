import type { Story } from "../../domain/types.ts";

/* ---------------------------------------------------------
   財務諸表ストーリー②
   ①で扱わなかった表示を中心にした2本目。
   建物と備品の減価償却累計額をそれぞれの資産の下に△で出し、
   貯蔵品・未払費用（未払給料）・未収収益（未収利息）・前受金を扱う。
   会計期間は4月1日〜3月31日。数値はすべてオリジナル。
--------------------------------------------------------- */

export const STATEMENTS_STORY_2: Story = {
  id: "story-fs-2",
  topicId: "fs-preparation",
  table: "statements",
  title: "財務諸表ストーリー②",
  intro:
    "モモ商事の決算日（3月31日）です。決算整理前の金額で作った損益計算書と貸借対照表の下書きに、決算整理事項を1つずつ反映して完成させましょう。",
  accounts: [
    { account: "現金", side: "借", tb: 80000 },
    { account: "現金過不足", side: "借", tb: 2500 },
    { account: "当座預金", side: "借", tb: 300000 },
    { account: "売掛金", side: "借", tb: 350000 },
    { account: "繰越商品", side: "借", tb: 75000 },
    { account: "仮払消費税", side: "借", tb: 48000 },
    { account: "仮払法人税等", side: "借", tb: 15000 },
    { account: "貸付金", side: "借", tb: 300000 },
    { account: "建物", side: "借", tb: 1500000 },
    { account: "備品", side: "借", tb: 360000 },
    { account: "買掛金", side: "貸", tb: 220000 },
    { account: "仮受金", side: "貸", tb: 30000 },
    { account: "仮受消費税", side: "貸", tb: 85000 },
    { account: "貸倒引当金", side: "貸", tb: 4000 },
    { account: "建物減価償却累計額", side: "貸", tb: 500000 },
    { account: "備品減価償却累計額", side: "貸", tb: 120000 },
    { account: "資本金", side: "貸", tb: 1500000 },
    { account: "繰越利益剰余金", side: "貸", tb: 291500 },
    { account: "売上", side: "貸", tb: 1250000, pl: true },
    { account: "受取利息", side: "貸", tb: 3000, pl: true },
    { account: "仕入", side: "借", tb: 640000, pl: true },
    { account: "給料", side: "借", tb: 216000, pl: true },
    { account: "支払家賃", side: "借", tb: 99000, pl: true },
    { account: "租税公課", side: "借", tb: 18000, pl: true },
    // 決算整理で追加する科目
    { account: "前受金", side: "貸" },
    { account: "雑損", side: "借", pl: true },
    { account: "貸倒引当金繰入", side: "借", pl: true },
    { account: "減価償却費", side: "借", pl: true },
    { account: "貯蔵品", side: "借" },
    { account: "未払給料", side: "貸" },
    { account: "未収利息", side: "借" },
    { account: "前払家賃", side: "借" },
    { account: "未払消費税", side: "貸" },
    { account: "法人税、住民税及び事業税", side: "借", pl: true },
    { account: "未払法人税等", side: "貸" },
  ],
  lines: [
    // 損益計算書
    { label: "売上原価", statement: "PL", accounts: ["仕入"] },
    { label: "給料", statement: "PL", accounts: ["給料"] },
    { label: "支払家賃", statement: "PL", accounts: ["支払家賃"] },
    { label: "租税公課", statement: "PL", accounts: ["租税公課"] },
    { label: "雑損", statement: "PL", accounts: ["雑損"] },
    { label: "貸倒引当金繰入", statement: "PL", accounts: ["貸倒引当金繰入"] },
    { label: "減価償却費", statement: "PL", accounts: ["減価償却費"] },
    { label: "法人税、住民税及び事業税", statement: "PL", accounts: ["法人税、住民税及び事業税"] },
    { label: "売上高", statement: "PL", accounts: ["売上"] },
    { label: "受取利息", statement: "PL", accounts: ["受取利息"] },
    // 貸借対照表（資産の部）
    { label: "現金", statement: "BS", accounts: ["現金"] },
    { label: "当座預金", statement: "BS", accounts: ["当座預金"] },
    { label: "売掛金", statement: "BS", accounts: ["売掛金"] },
    { label: "貸倒引当金", statement: "BS", accounts: ["貸倒引当金"], contra: true },
    { label: "商品", statement: "BS", accounts: ["繰越商品"] },
    { label: "貯蔵品", statement: "BS", accounts: ["貯蔵品"] },
    { label: "前払費用", statement: "BS", accounts: ["前払家賃"] },
    { label: "未収収益", statement: "BS", accounts: ["未収利息"] },
    { label: "貸付金", statement: "BS", accounts: ["貸付金"] },
    { label: "建物", statement: "BS", accounts: ["建物"] },
    { label: "建物減価償却累計額", display: "減価償却累計額", statement: "BS", accounts: ["建物減価償却累計額"], contra: true },
    { label: "備品", statement: "BS", accounts: ["備品"] },
    { label: "備品減価償却累計額", display: "減価償却累計額", statement: "BS", accounts: ["備品減価償却累計額"], contra: true },
    { label: "現金過不足", statement: "BS", accounts: ["現金過不足"], temp: true },
    { label: "仮払消費税", statement: "BS", accounts: ["仮払消費税"], temp: true },
    { label: "仮払法人税等", statement: "BS", accounts: ["仮払法人税等"], temp: true },
    // 貸借対照表（負債・純資産の部）
    { label: "買掛金", statement: "BS", accounts: ["買掛金"] },
    { label: "前受金", statement: "BS", accounts: ["前受金"] },
    { label: "未払費用", statement: "BS", accounts: ["未払給料"] },
    { label: "未払消費税", statement: "BS", accounts: ["未払消費税"] },
    { label: "未払法人税等", statement: "BS", accounts: ["未払法人税等"] },
    { label: "仮受金", statement: "BS", accounts: ["仮受金"], temp: true },
    { label: "仮受消費税", statement: "BS", accounts: ["仮受消費税"], temp: true },
    { label: "資本金", statement: "BS", accounts: ["資本金"] },
    { label: "繰越利益剰余金", statement: "BS", accounts: ["繰越利益剰余金"] },
  ],
  steps: [
    {
      item: "仮受金¥30,000は、得意先から受け取った商品の手付金であることが判明した。",
      entries: [
        { account: "仮受金", dr: 30000 },
        { account: "前受金", cr: 30000 },
      ],
      distractors: ["60,000", "15,000"],
      explanation: "仮受金は0になって消え、中身の前受金（負債）30,000円が貸借対照表に載ります。",
    },
    {
      item: "現金過不足（借方残高）¥2,500は、原因が分からないため雑損とする。",
      entries: [
        { account: "現金過不足", cr: 2500 },
        { account: "雑損", dr: 2500 },
      ],
      distractors: ["5,000", "1,250"],
      explanation: "現金過不足は0になって財務諸表から消えます。借方残高（現金が足りなかった）なので、費用の雑損2,500円になります。",
    },
    {
      item: "売掛金の期末残高に対して2%の貸倒引当金を、差額補充法で設定する。",
      entries: [
        { account: "貸倒引当金", cr: 3000 },
        { account: "貸倒引当金繰入", dr: 3000 },
      ],
      distractors: ["4,000", "10,500"],
      explanation: "350,000×2%＝7,000円を売掛金の下に△7,000と表示します。繰入はすでにある4,000円との差額の3,000円です。",
    },
    {
      item: "期末商品棚卸高は¥82,000である。",
      entries: [
        { account: "繰越商品", dr: 82000, cr: 75000 },
        { account: "仕入", dr: 75000, cr: 82000 },
      ],
      distractors: ["647,000", "75,000"],
      explanation: "繰越商品は「商品」として82,000円を表示します。売上原価は640,000＋75,000−82,000＝633,000円です。",
    },
    {
      item: "建物（耐用年数30年）と備品（耐用年数6年）について、残存価額ゼロの定額法で減価償却を行う。",
      entries: [
        { account: "建物減価償却累計額", cr: 50000 },
        { account: "備品減価償却累計額", cr: 60000 },
        { account: "減価償却費", dr: 110000 },
      ],
      distractors: ["160,000", "610,000"],
      explanation:
        "建物は1,500,000÷30年＝50,000円、備品は360,000÷6年＝60,000円で、減価償却費は合計110,000円です。貸借対照表では、建物の下に△550,000、備品の下に△180,000と、それぞれの資産から差し引いて表示します。",
    },
    {
      item: "収入印紙¥4,000が未使用のまま残っている。",
      entries: [
        { account: "租税公課", cr: 4000 },
        { account: "貯蔵品", dr: 4000 },
      ],
      distractors: ["22,000", "8,000"],
      explanation: "使っていない収入印紙は租税公課から差し引き、貯蔵品（資産）にします。租税公課は18,000−4,000＝14,000円です。",
    },
    {
      item: "給料の未払分が¥18,000ある。",
      entries: [
        { account: "給料", dr: 18000 },
        { account: "未払給料", cr: 18000 },
      ],
      distractors: ["198,000", "36,000"],
      explanation: "給料は216,000＋18,000＝234,000円です。未払給料は、貸借対照表では「未払費用」と表示します。",
    },
    {
      item: "貸付金¥300,000は、1月1日に年利率4%で貸し付けたものである（利息は返済時に受け取る）。利息を月割で見越し計上する。",
      entries: [
        { account: "未収利息", dr: 3000 },
        { account: "受取利息", cr: 3000 },
      ],
      distractors: ["9,000", "12,000"],
      explanation: "1月〜3月の3か月分、300,000×4%×3/12＝3,000円が当期の収益です。未収利息は「未収収益」と表示します。受取利息は3,000＋3,000＝6,000円です。",
    },
    {
      item: "支払家賃のうち¥27,000は、3月1日に3月〜5月の3か月分を支払ったものである。前払分を月割で繰り延べる。",
      entries: [
        { account: "支払家賃", cr: 18000 },
        { account: "前払家賃", dr: 18000 },
      ],
      distractors: ["9,000", "72,000"],
      explanation: "4月・5月の2か月分（27,000×2/3＝18,000円）は次期の費用です。前払家賃は「前払費用」と表示し、支払家賃は99,000−18,000＝81,000円になります。",
    },
    {
      item: "消費税の処理（税抜方式）を行う。",
      entries: [
        { account: "仮払消費税", cr: 48000 },
        { account: "仮受消費税", dr: 85000 },
        { account: "未払消費税", cr: 37000 },
      ],
      distractors: ["133,000", "48,000"],
      explanation: "仮払消費税と仮受消費税は相殺して0になり、財務諸表から消えます。差額の85,000−48,000＝37,000円が未払消費税です。",
    },
    {
      item: "法人税、住民税及び事業税¥53,000を計上する。中間納付額は仮払法人税等で処理している。",
      entries: [
        { account: "法人税、住民税及び事業税", dr: 53000 },
        { account: "仮払法人税等", cr: 15000 },
        { account: "未払法人税等", cr: 38000 },
      ],
      distractors: ["68,000", "15,000"],
      explanation: "仮払法人税等は0になって消えます。53,000円から中間納付の15,000円を引いた38,000円が未払法人税等です。",
    },
  ],
  finale: {
    distractors: ["178,500", "291,500", "470,000"],
    explanation:
      "収益1,256,000円から費用1,130,500円を引いて、当期純利益は125,500円です。繰越利益剰余金は291,500＋125,500＝417,000円になり、資産合計と負債・純資産合計が一致します。",
  },
};
