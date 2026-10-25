import type { ChapterInfo, LessonNode } from "../domain/types.ts";

/* ---------------------------------------------------------
   コース2: TAC出版準拠コース（教科書の章立て）
--------------------------------------------------------- */

export const TAC_CHAPTERS: Record<string, ChapterInfo> = {
  ch1: { title: "CHAPTER 01", subtitle: "簿記の基礎", bg: "bg-indigo-500", sub: "text-indigo-100" },
  ch2: { title: "CHAPTER 02", subtitle: "商品売買", bg: "bg-violet-500", sub: "text-violet-100" },
};

export const TAC_NODES: LessonNode[] = [
  {
    id: "t1", title: "簿記の基礎（5要素）", kind: "concept", chapter: "ch1",
    desc: "資産・負債・純資産・収益・費用を分類します。",
    questions: [
      { id: "t1-1", format: "classify", prompt: "現金", answer: "資産", explanation: "現金は資産です。" },
      { id: "t1-2", format: "classify", prompt: "建物", answer: "資産", explanation: "建物は資産です。" },
      { id: "t1-3", format: "classify", prompt: "借入金", answer: "負債", explanation: "借入金は負債です。" },
      { id: "t1-4", format: "classify", prompt: "資本金", answer: "純資産", explanation: "資本金は純資産です。" },
      { id: "t1-5", format: "classify", prompt: "売上", answer: "収益", explanation: "売上は収益です。" },
      { id: "t1-6", format: "classify", prompt: "仕入", answer: "費用", explanation: "仕入は費用です。" },
      { id: "t1-7", format: "classify", prompt: "売掛金", answer: "資産", explanation: "売掛金は資産です。" },
      { id: "t1-8", format: "classify", prompt: "買掛金", answer: "負債", explanation: "買掛金は負債です。" },
    ],
  },
  {
    id: "t2", title: "借方・貸方のルール", kind: "concept", chapter: "ch1",
    desc: "5要素の増減とホームポジションを覚えます。",
    questions: [
      { id: "t2-1", format: "twochoice", prompt: "資産が増えたときの記入場所は？", options: ["借方", "貸方"], answer: "借方", explanation: "資産の増加は借方です。" },
      { id: "t2-2", format: "twochoice", prompt: "負債が増えたときの記入場所は？", options: ["借方", "貸方"], answer: "貸方", explanation: "負債の増加は貸方です。" },
      { id: "t2-3", format: "twochoice", prompt: "費用が発生したときの記入場所は？", options: ["借方", "貸方"], answer: "借方", explanation: "費用の発生は借方です。" },
      { id: "t2-4", format: "twochoice", prompt: "収益が発生したときの記入場所は？", options: ["借方", "貸方"], answer: "貸方", explanation: "収益の発生は貸方です。" },
      { id: "t2-5", format: "twochoice", prompt: "純資産が増えたときの記入場所は？", options: ["借方", "貸方"], answer: "貸方", explanation: "純資産の増加は貸方です。" },
      { id: "t2-6", format: "twochoice", prompt: "資産が減ったときの記入場所は？", options: ["借方", "貸方"], answer: "貸方", explanation: "資産の減少は貸方です。" },
    ],
  },
  {
    id: "t3", title: "仕訳と転記の基本用語", kind: "concept", chapter: "ch1",
    desc: "仕訳帳・総勘定元帳など基本ワードです。",
    questions: [
      { id: "t3-1", format: "fillblank", prompt: "取引を借方・貸方に分けて記録することを［　］という。", options: ["仕訳", "転記", "試算表", "精算表"], answer: "仕訳", explanation: "この作業を仕訳といいます。" },
      { id: "t3-2", format: "fillblank", prompt: "仕訳を最初に記入する帳簿を［　］という。", options: ["仕訳帳", "総勘定元帳", "補助簿", "伝票"], answer: "仕訳帳", explanation: "仕訳は仕訳帳に記入します。" },
      { id: "t3-3", format: "fillblank", prompt: "仕訳帳から総勘定元帳へ書き写すことを［　］という。", options: ["転記", "仕訳", "集計", "記帳"], answer: "転記", explanation: "この作業を転記といいます。" },
      { id: "t3-4", format: "fillblank", prompt: "各勘定科目ごとに金額を記録する帳簿を［　］という。", options: ["総勘定元帳", "仕訳帳", "補助簿", "伝票"], answer: "総勘定元帳", explanation: "総勘定元帳に転記します。" },
      { id: "t3-5", format: "fillblank", prompt: "資産・負債・純資産の一覧表を［　］という。", options: ["貸借対照表", "損益計算書", "試算表", "精算表"], answer: "貸借対照表", explanation: "B/S（貸借対照表）です。" },
      { id: "t3-6", format: "fillblank", prompt: "収益・費用の一覧表を［　］という。", options: ["損益計算書", "貸借対照表", "試算表", "元帳"], answer: "損益計算書", explanation: "P/L（損益計算書）です。" },
    ],
  },
  {
    id: "t4", title: "かんたんな仕訳", kind: "training", chapter: "ch1",
    desc: "借方・貸方をセットで入力する仕訳の練習です。",
    questions: [
      { id: "t4-1", format: "journal", prompt: "現金300,000円を元入れして開業した。", debitAccount: "現金", debitAmount: 300000, creditAccount: "資本金", creditAmount: 300000, explanation: "開業のための出資は資本金として貸方に記入します。" },
      { id: "t4-2", format: "journal", prompt: "商品50,000円を仕入れ、代金は現金で支払った。", debitAccount: "仕入", debitAmount: 50000, creditAccount: "現金", creditAmount: 50000, explanation: "仕入（費用）の発生は借方、現金の減少は貸方です。" },
      { id: "t4-3", format: "journal", prompt: "商品80,000円を売り上げ、代金は現金で受け取った。", debitAccount: "現金", debitAmount: 80000, creditAccount: "売上", creditAmount: 80000, explanation: "現金の増加は借方、売上（収益）の発生は貸方です。" },
      { id: "t4-4", format: "journal", prompt: "銀行から200,000円を借り入れ、現金で受け取った。", debitAccount: "現金", debitAmount: 200000, creditAccount: "借入金", creditAmount: 200000, explanation: "現金の増加は借方、借入金（負債）の増加は貸方です。" },
      { id: "t4-5", format: "journal", prompt: "買掛金30,000円を現金で支払った。", debitAccount: "買掛金", debitAmount: 30000, creditAccount: "現金", creditAmount: 30000, explanation: "買掛金（負債）の減少は借方、現金の減少は貸方です。" },
    ],
  },
  {
    id: "t5", title: "CHAPTER01 チェック", kind: "checkpoint", chapter: "ch1",
    desc: "簿記の基礎の確認テストです（合格ライン70%）。",
    questions: [
      { id: "t5-1", format: "classify", prompt: "備品", answer: "資産", explanation: "備品は資産です。" },
      { id: "t5-2", format: "twochoice", prompt: "収益が発生したときの記入場所は？", options: ["借方", "貸方"], answer: "貸方", explanation: "収益の発生は貸方です。" },
      { id: "t5-3", format: "journal", prompt: "商品40,000円を売り上げ、代金は現金で受け取った。", debitAccount: "現金", debitAmount: 40000, creditAccount: "売上", creditAmount: 40000, explanation: "現金の増加は借方、売上の発生は貸方です。" },
    ],
  },
  {
    id: "t6", title: "商品売買の用語", kind: "concept", chapter: "ch2",
    desc: "仕入・売上・繰越商品などの基本用語です。",
    questions: [
      { id: "t6-1", format: "classify", prompt: "仕入", answer: "費用", explanation: "商品の仕入れにかかった金額は仕入（費用）です。" },
      { id: "t6-2", format: "classify", prompt: "売上", answer: "収益", explanation: "商品を売った代金は売上（収益）です。" },
      { id: "t6-3", format: "classify", prompt: "繰越商品", answer: "資産", explanation: "決算時点で残っている商品は繰越商品（資産）です。" },
      { id: "t6-4", format: "classify", prompt: "売掛金", answer: "資産", explanation: "商品代金を後で受け取る権利は資産です。" },
      { id: "t6-5", format: "classify", prompt: "買掛金", answer: "負債", explanation: "商品代金を後で支払う義務は負債です。" },
      { id: "t6-6", format: "classify", prompt: "現金", answer: "資産", explanation: "現金は資産です。" },
    ],
  },
  {
    id: "t7", title: "三分法と掛け取引", kind: "concept", chapter: "ch2",
    desc: "三分法のしくみと「掛け」の取引を扱います。",
    questions: [
      { id: "t7-1", format: "twochoice", prompt: "商品を掛けで売り上げたときに増える勘定科目は？", options: ["売掛金", "買掛金"], answer: "売掛金", explanation: "代金を後で受け取る権利＝売掛金が増えます。" },
      { id: "t7-2", format: "twochoice", prompt: "商品を掛けで仕入れたときに増える勘定科目は？", options: ["売掛金", "買掛金"], answer: "買掛金", explanation: "代金を後で支払う義務＝買掛金が増えます。" },
      { id: "t7-3", format: "twochoice", prompt: "売掛金を現金で回収した。売掛金は？", options: ["増える", "減る"], answer: "減る", explanation: "回収した分だけ売掛金は減ります。" },
      { id: "t7-4", format: "twochoice", prompt: "買掛金を現金で支払った。買掛金は？", options: ["増える", "減る"], answer: "減る", explanation: "支払った分だけ買掛金は減ります。" },
      { id: "t7-5", format: "twochoice", prompt: "得意先に商品を掛けで売った。仕訳の借方科目は？", options: ["売掛金", "売上"], answer: "売掛金", explanation: "資産の増加なので借方は売掛金です。" },
      { id: "t7-6", format: "twochoice", prompt: "仕入先から商品を掛けで仕入れた。仕訳の貸方科目は？", options: ["買掛金", "仕入"], answer: "買掛金", explanation: "負債の増加なので貸方は買掛金です。" },
    ],
  },
  {
    id: "t8", title: "返品の処理", kind: "concept", chapter: "ch2",
    desc: "仕入戻し・売上戻りの仕訳パターンです。",
    questions: [
      { id: "t8-1", format: "journal", prompt: "掛けで仕入れた商品5,000円を品違いのため返品した。", debitAccount: "買掛金", debitAmount: 5000, creditAccount: "仕入", creditAmount: 5000, explanation: "仕入戻しは仕入（費用）を取り消すため貸方に記入し、買掛金（負債）も減らします。" },
      { id: "t8-2", format: "journal", prompt: "掛けで売り上げた商品7,000円が返品された。", debitAccount: "売上", debitAmount: 7000, creditAccount: "売掛金", creditAmount: 7000, explanation: "売上戻りは売上（収益）を取り消すため借方に記入し、売掛金（資産）も減らします。" },
      { id: "t8-3", format: "twochoice", prompt: "仕入戻しがあったとき、仕入は増える？減る？", options: ["増える", "減る"], answer: "減る", explanation: "返品した分だけ仕入は取り消されて減ります。" },
      { id: "t8-4", format: "twochoice", prompt: "売上戻りがあったとき、売上は増える？減る？", options: ["増える", "減る"], answer: "減る", explanation: "返品された分だけ売上は取り消されて減ります。" },
      { id: "t8-5", format: "twochoice", prompt: "仕入戻しは仕訳のどちら側に記入する？", options: ["借方", "貸方"], answer: "貸方", explanation: "仕入（費用）の取り消しなので貸方に記入します。" },
      { id: "t8-6", format: "twochoice", prompt: "売上戻りは仕訳のどちら側に記入する？", options: ["借方", "貸方"], answer: "借方", explanation: "売上（収益）の取り消しなので借方に記入します。" },
    ],
  },
  {
    id: "t9", title: "クレジット売掛金", kind: "concept", chapter: "ch2",
    desc: "クレジット払いによる売上の処理です。",
    questions: [
      { id: "t9-1", format: "classify", prompt: "クレジット売掛金", answer: "資産", explanation: "クレジット払いの売上代金を受け取る権利は資産です。" },
      { id: "t9-2", format: "classify", prompt: "支払手数料", answer: "費用", explanation: "クレジット決済にかかる手数料は費用です。" },
      { id: "t9-3", format: "journal", prompt: "商品20,000円をクレジット払い条件で売り上げた（手数料は考慮しない）。", debitAccount: "クレジット売掛金", debitAmount: 20000, creditAccount: "売上", creditAmount: 20000, explanation: "クレジット売掛金（資産）の増加は借方、売上（収益）の発生は貸方です。" },
      { id: "t9-4", format: "twochoice", prompt: "クレジット売掛金は貸借対照表でどちらに分類される？", options: ["資産", "負債"], answer: "資産", explanation: "クレジット売掛金は資産です。" },
    ],
  },
  {
    id: "t10", title: "諸掛りの処理", kind: "concept", chapter: "ch2",
    desc: "仕入諸掛・発送費の処理です。",
    questions: [
      { id: "t10-1", format: "classify", prompt: "仕入諸掛（引取運賃）", answer: "費用", explanation: "商品仕入れにかかった運賃は仕入原価に含め、仕入（費用）として処理します。" },
      { id: "t10-2", format: "classify", prompt: "発送費", answer: "費用", explanation: "商品を売り上げた際の発送費用は費用です。" },
      { id: "t10-3", format: "journal", prompt: "商品にかかった引取運賃1,000円を現金で支払った（仕入原価に含める）。", debitAccount: "仕入", debitAmount: 1000, creditAccount: "現金", creditAmount: 1000, explanation: "引取運賃は仕入原価に含めるため仕入で処理します。" },
      { id: "t10-4", format: "journal", prompt: "商品を売り上げた際の発送費600円を現金で支払った（発送費は当社負担）。", debitAccount: "発送費", debitAmount: 600, creditAccount: "現金", creditAmount: 600, explanation: "当社負担の発送費は発送費（費用）として処理します。" },
    ],
  },
  {
    id: "t11", title: "CHAPTER02 チェック", kind: "checkpoint", chapter: "ch2",
    desc: "商品売買の確認テストです（合格ライン70%）。",
    questions: [
      { id: "t11-1", format: "twochoice", prompt: "仕入戻しは仕訳のどちら側に記入する？", options: ["借方", "貸方"], answer: "貸方", explanation: "仕入（費用）の取り消しなので貸方です。" },
      { id: "t11-2", format: "classify", prompt: "クレジット売掛金", answer: "資産", explanation: "クレジット売掛金は資産です。" },
      { id: "t11-3", format: "journal", prompt: "掛けで仕入れた商品4,000円を返品した。", debitAccount: "買掛金", debitAmount: 4000, creditAccount: "仕入", creditAmount: 4000, explanation: "買掛金（負債）の減少は借方、仕入（費用）の取り消しは貸方です。" },
    ],
  },
];
