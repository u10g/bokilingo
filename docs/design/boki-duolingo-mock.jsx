import React, { useState, useEffect } from "react";
import {
  Flame,
  Heart,
  Gem,
  Lock,
  Check,
  Star,
  X,
  BookOpen,
  Dumbbell,
  Trophy,
  ChevronDown,
} from "lucide-react";

/* ---------------------------------------------------------
   永続化ユーティリティ
   進捗はすべて1つのキーにまとめて window.storage に保存する。
--------------------------------------------------------- */

const STORAGE_KEY = "boki-quest-progress-v1";
const EMPTY_COMPLETED_SETS = { accounts: new Set(), journalBlank: new Set(), tac: new Set(), pattern: new Set() };

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

// 出題順を毎回入れ替え、並び順の丸暗記を防ぐ
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PASS_RATE = 0.7; // チェックポイントの合格ライン

async function loadProgress() {
  try {
    const result = await window.storage.get(STORAGE_KEY);
    if (!result || !result.value) return null;
    return JSON.parse(result.value);
  } catch (e) {
    return null; // 初回アクセスなどデータが無い場合はデフォルトのまま進める
  }
}

async function saveProgress(snapshot) {
  try {
    const payload = {
      activeCourseId: snapshot.activeCourseId,
      completedSets: {
        accounts: Array.from(snapshot.completedSets.accounts),
        journalBlank: Array.from(snapshot.completedSets.journalBlank),
        tac: Array.from(snapshot.completedSets.tac),
        pattern: Array.from(snapshot.completedSets.pattern),
      },
      solvedCount: snapshot.solvedCount,
      totalXp: snapshot.totalXp,
      streak: snapshot.streak,
      lastActiveDate: snapshot.lastActiveDate,
      wrongToday: snapshot.wrongToday,
      wrongTodayDate: snapshot.wrongTodayDate,
    };
    await window.storage.set(STORAGE_KEY, JSON.stringify(payload), false);
  } catch (e) {
    // 保存に失敗してもアプリの利用自体は継続する
  }
}

async function clearProgress() {
  try {
    await window.storage.delete(STORAGE_KEY);
  } catch (e) {
    // キーが無い場合などは無視する
  }
}

/* ---------------------------------------------------------
   共通データ
--------------------------------------------------------- */

const ACCOUNTS = [
  "現金",
  "当座預金",
  "普通預金",
  "小口現金",
  "売上",
  "仕入",
  "繰越商品",
  "資本金",
  "借入金",
  "給料",
  "買掛金",
  "売掛金",
  "前払金",
  "前受金",
  "クレジット売掛金",
  "仮払金",
  "仮受金",
  "立替金",
  "現金過不足",
  "雑損",
  "雑益",
  "受取手数料",
  "旅費交通費",
  "発送費",
  "建物",
  "備品",
  "土地",
];

const ELEMENTS = ["資産", "負債", "純資産", "収益", "費用"];

const PRAISE = ["せいかい！", "いいね！", "そのとおり！", "ばっちり！"];

/* ---------------------------------------------------------
   コース1: 仕訳穴埋めコース
   仕訳表の勘定科目セルだけを空欄にし、下部の選択肢から埋める。
   金額は最初から埋まっているので、勘定科目の判断だけに集中できる。
   借方・貸方の行数が違う複合仕訳も同じ形式で扱える。
--------------------------------------------------------- */

const JOURNAL_BLANK_CHAPTERS = {
  jbA: { title: "CHAPTER A", subtitle: "商品を仕入れて売る", bg: "bg-teal-500", sub: "text-teal-100" },
  jbB: { title: "CHAPTER B", subtitle: "お金を持つ・預ける", bg: "bg-sky-500", sub: "text-sky-100" },
  jbC: { title: "CHAPTER C", subtitle: "貸し借りと手形", bg: "bg-indigo-500", sub: "text-indigo-100" },
  jbD: { title: "CHAPTER D", subtitle: "従業員とお金", bg: "bg-violet-500", sub: "text-violet-100" },
  jbE: { title: "CHAPTER E", subtitle: "会社を運営する経費", bg: "bg-orange-500", sub: "text-orange-100" },
  jbF: { title: "CHAPTER F", subtitle: "固定資産を持つ", bg: "bg-amber-600", sub: "text-amber-100" },
  jbG: { title: "CHAPTER G", subtitle: "決算で整理する", bg: "bg-rose-500", sub: "text-rose-100" },
};

const JOURNAL_BLANK_NODES = [
  /* ===== CHAPTER A: 商品を仕入れて売る ===== */
  {
    id: "jb1", title: "商品売買の仕訳", kind: "concept", chapter: "jbA",
    desc: "反対側をヒントに、片側の勘定科目を空欄から選んで埋めます。",
    questions: [
      {
        id: "jb1-q1", format: "journalBlank", blankSide: "debit",
        prompt: "商品50,000円を仕入れ、代金は現金で支払った。",
        rows: [{ debitAnswer: "仕入", debitAmount: 50000, creditAnswer: "現金", creditAmount: 50000 }],
        choices: ["仕入", "売上", "買掛金", "売掛金"],
        explanation: "現金が減った理由は商品の仕入れです。仕入（費用）の発生を借方に記入します。",
      },
      {
        id: "jb1-q2", format: "journalBlank", blankSide: "credit",
        prompt: "商品80,000円を売り上げ、代金は現金で受け取った。",
        rows: [{ debitAnswer: "現金", debitAmount: 80000, creditAnswer: "売上", creditAmount: 80000 }],
        choices: ["売上", "仕入", "売掛金", "買掛金"],
        explanation: "現金が増えた理由は商品の売上です。売上（収益）の発生を貸方に記入します。",
      },
      {
        id: "jb1-q3", format: "journalBlank", blankSide: "credit",
        prompt: "商品70,000円を仕入れ、代金は掛けとした。",
        rows: [{ debitAnswer: "仕入", debitAmount: 70000, creditAnswer: "買掛金", creditAmount: 70000 }],
        choices: ["買掛金", "売掛金", "現金", "前払金"],
        explanation: "代金を後で支払う義務が生じます。買掛金（負債）の増加を貸方に記入します。",
      },
      {
        id: "jb1-q4", format: "journalBlank", blankSide: "debit",
        prompt: "商品90,000円を売り上げ、代金は掛けとした。",
        rows: [{ debitAnswer: "売掛金", debitAmount: 90000, creditAnswer: "売上", creditAmount: 90000 }],
        choices: ["売掛金", "買掛金", "現金", "前受金"],
        explanation: "代金を後で受け取る権利が生じます。売掛金（資産）の増加を借方に記入します。",
      },
      {
        id: "jb1-q5", format: "journalBlank", blankSide: "debit",
        prompt: "買掛金40,000円を現金で支払った。",
        rows: [{ debitAnswer: "買掛金", debitAmount: 40000, creditAnswer: "現金", creditAmount: 40000 }],
        choices: ["買掛金", "売掛金", "仕入", "前払金"],
        explanation: "支払う義務がなくなります。買掛金（負債）の減少を借方に記入します。",
      },
      {
        id: "jb1-q6", format: "journalBlank", blankSide: "credit",
        prompt: "売掛金60,000円を現金で回収した。",
        rows: [{ debitAnswer: "現金", debitAmount: 60000, creditAnswer: "売掛金", creditAmount: 60000 }],
        choices: ["売掛金", "買掛金", "売上", "前受金"],
        explanation: "受け取る権利がなくなります。売掛金（資産）の減少を貸方に記入します。",
      },
      {
        id: "jb1-q7", format: "journalBlank", blankSide: "credit",
        prompt: "商品60,000円を仕入れ、20,000円は現金で支払い、残額は掛けとした。",
        rows: [
          { debitAnswer: "仕入", debitAmount: 60000, creditAnswer: "現金", creditAmount: 20000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "買掛金", creditAmount: 40000 },
        ],
        choices: ["現金", "買掛金", "売掛金", "売上"],
        explanation: "貸方が2行に分かれます。すぐ払った20,000円が現金、後払いの40,000円が買掛金です。",
      },
      {
        id: "jb1-q8", format: "journalBlank", blankSide: "debit",
        prompt: "商品100,000円を売り上げ、30,000円は現金で受け取り、残額は掛けとした。",
        rows: [
          { debitAnswer: "現金", debitAmount: 30000, creditAnswer: "売上", creditAmount: 100000 },
          { debitAnswer: "売掛金", debitAmount: 70000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["現金", "売掛金", "買掛金", "仕入"],
        explanation: "借方が2行に分かれます。すぐ受け取った30,000円が現金、後払いの70,000円が売掛金です。",
      },
    ],
  },
  {
    id: "jb2", title: "返品と諸掛り", kind: "concept", chapter: "jbA",
    desc: "返品・運賃・内金など、商品売買に付随する仕訳です。",
    questions: [
      {
        id: "jb2-q1", format: "journalBlank", blankSide: "debit",
        prompt: "掛けで仕入れた商品5,000円を品違いのため返品した。",
        rows: [{ debitAnswer: "買掛金", debitAmount: 5000, creditAnswer: "仕入", creditAmount: 5000 }],
        choices: ["買掛金", "売掛金", "前払金", "現金"],
        explanation: "仕入が取り消されると同時に、支払う義務も消えます。買掛金の減少を借方に記入します。",
      },
      {
        id: "jb2-q2", format: "journalBlank", blankSide: "credit",
        prompt: "掛けで売り上げた商品7,000円が返品された。",
        rows: [{ debitAnswer: "売上", debitAmount: 7000, creditAnswer: "売掛金", creditAmount: 7000 }],
        choices: ["売掛金", "買掛金", "現金", "前受金"],
        explanation: "売上が取り消されると同時に、受け取る権利も消えます。売掛金の減少を貸方に記入します。",
      },
      {
        id: "jb2-q3", format: "journalBlank", blankSide: "debit",
        prompt: "商品の引取運賃2,000円を現金で支払った。運賃は仕入原価に含める。",
        rows: [{ debitAnswer: "仕入", debitAmount: 2000, creditAnswer: "現金", creditAmount: 2000 }],
        choices: ["仕入", "発送費", "支払手数料", "通信費"],
        explanation: "引取運賃は商品を手に入れるための費用なので、仕入原価に含めて仕入で処理します。",
      },
      {
        id: "jb2-q4", format: "journalBlank", blankSide: "debit",
        prompt: "商品を発送した際の運賃600円を現金で支払った。当社負担である。",
        rows: [{ debitAnswer: "発送費", debitAmount: 600, creditAnswer: "現金", creditAmount: 600 }],
        choices: ["発送費", "仕入", "通信費", "支払手数料"],
        explanation: "売るためにかかった運賃は仕入原価に含めず、発送費（費用）で処理します。",
      },
      {
        id: "jb2-q5", format: "journalBlank", blankSide: "debit",
        prompt: "商品30,000円をクレジット払いの条件で売り上げた。手数料は考慮しない。",
        rows: [{ debitAnswer: "クレジット売掛金", debitAmount: 30000, creditAnswer: "売上", creditAmount: 30000 }],
        choices: ["クレジット売掛金", "売掛金", "受取手形", "現金"],
        explanation: "信販会社から後で受け取る権利なので、通常の売掛金と区別してクレジット売掛金を使います。",
      },
      {
        id: "jb2-q6", format: "journalBlank", blankSide: "debit",
        prompt: "商品を注文し、内金として10,000円を現金で支払った。",
        rows: [{ debitAnswer: "前払金", debitAmount: 10000, creditAnswer: "現金", creditAmount: 10000 }],
        choices: ["前払金", "前受金", "仕入", "立替金"],
        explanation: "商品はまだ受け取っていません。商品を受け取る権利として前払金（資産）で処理します。",
      },
    ],
  },
  {
    id: "jb-a-check", title: "CHAPTER A チェック", kind: "checkpoint", chapter: "jbA",
    desc: "商品売買の仕訳の確認テストです（合格ライン70%）。",
    questions: [
      {
        id: "jb-a-c1", format: "journalBlank", blankSide: "credit",
        prompt: "商品45,000円を仕入れ、代金は掛けとした。",
        rows: [{ debitAnswer: "仕入", debitAmount: 45000, creditAnswer: "買掛金", creditAmount: 45000 }],
        choices: ["買掛金", "売掛金", "前払金", "現金"],
        explanation: "後で支払う義務が生じるので、買掛金（負債）の増加を貸方に記入します。",
      },
      {
        id: "jb-a-c2", format: "journalBlank", blankSide: "debit",
        prompt: "掛けで仕入れた商品3,000円を返品した。",
        rows: [{ debitAnswer: "買掛金", debitAmount: 3000, creditAnswer: "仕入", creditAmount: 3000 }],
        choices: ["買掛金", "売掛金", "前払金", "発送費"],
        explanation: "返品で支払う義務が消えるので、買掛金の減少を借方に記入します。",
      },
      {
        id: "jb-a-c3", format: "journalBlank", blankSide: "debit",
        prompt: "商品25,000円をクレジット払いの条件で売り上げた。",
        rows: [{ debitAnswer: "クレジット売掛金", debitAmount: 25000, creditAnswer: "売上", creditAmount: 25000 }],
        choices: ["クレジット売掛金", "売掛金", "受取手形", "前受金"],
        explanation: "信販会社から後で受け取る権利なので、クレジット売掛金を使います。",
      },
      {
        id: "jb-a-c4", format: "journalBlank", blankSide: "credit",
        prompt: "商品50,000円を仕入れ、10,000円は現金で支払い、残額は掛けとした。",
        rows: [
          { debitAnswer: "仕入", debitAmount: 50000, creditAnswer: "現金", creditAmount: 10000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "買掛金", creditAmount: 40000 },
        ],
        choices: ["現金", "買掛金", "売掛金", "前払金"],
        explanation: "すぐ払った10,000円が現金、後払いの40,000円が買掛金です。",
      },
    ],
  },

  /* ===== CHAPTER B: お金を持つ・預ける ===== */
  {
    id: "jb3", title: "現金と預金の移動", kind: "concept", chapter: "jbB",
    desc: "口座間の預け替えや、利息・手数料の仕訳です。",
    questions: [
      {
        id: "jb3-q1", format: "journalBlank", blankSide: "debit",
        prompt: "現金80,000円を当座預金に預け入れた。",
        rows: [{ debitAnswer: "当座預金", debitAmount: 80000, creditAnswer: "現金", creditAmount: 80000 }],
        choices: ["当座預金", "普通預金", "定期預金", "小口現金"],
        explanation: "現金が当座預金に姿を変えただけの取引です。当座預金（資産）の増加を借方に記入します。",
      },
      {
        id: "jb3-q2", format: "journalBlank", blankSide: "credit",
        prompt: "当座預金から現金50,000円を引き出した。",
        rows: [{ debitAnswer: "現金", debitAmount: 50000, creditAnswer: "当座預金", creditAmount: 50000 }],
        choices: ["当座預金", "普通預金", "定期預金", "小口現金"],
        explanation: "現金が増えた分だけ当座預金が減ります。当座預金の減少を貸方に記入します。",
      },
      {
        id: "jb3-q3", format: "journalBlank", blankSide: "credit",
        prompt: "普通預金口座に利息300円が入金された。",
        rows: [{ debitAnswer: "普通預金", debitAmount: 300, creditAnswer: "受取利息", creditAmount: 300 }],
        choices: ["受取利息", "支払利息", "受取手数料", "雑益"],
        explanation: "預金が増えた理由は利息の受け取りです。受取利息（収益）の発生を貸方に記入します。",
      },
      {
        id: "jb3-q4", format: "journalBlank", blankSide: "debit",
        prompt: "振込手数料500円が普通預金口座から引き落とされた。",
        rows: [{ debitAnswer: "支払手数料", debitAmount: 500, creditAnswer: "普通預金", creditAmount: 500 }],
        choices: ["支払手数料", "受取手数料", "通信費", "雑費"],
        explanation: "預金が減った理由は手数料の支払いです。支払手数料（費用）の発生を借方に記入します。",
      },
      {
        id: "jb3-q5", format: "journalBlank", blankSide: "debit",
        prompt: "普通預金100,000円を定期預金に預け替えた。",
        rows: [{ debitAnswer: "定期預金", debitAmount: 100000, creditAnswer: "普通預金", creditAmount: 100000 }],
        choices: ["定期預金", "当座預金", "小口現金", "現金"],
        explanation: "預金の種類が変わっただけの取引です。定期預金（資産）の増加を借方に記入します。",
      },
      {
        id: "jb3-q6", format: "journalBlank", blankSide: "credit",
        prompt: "買掛金30,000円を小切手を振り出して支払った。",
        rows: [{ debitAnswer: "買掛金", debitAmount: 30000, creditAnswer: "当座預金", creditAmount: 30000 }],
        choices: ["当座預金", "普通預金", "現金", "定期預金"],
        explanation: "小切手を振り出すと当座預金が減ります。当座預金の減少を貸方に記入します。",
      },
    ],
  },
  {
    id: "jb4", title: "現金過不足と小口現金", kind: "concept", chapter: "jbB",
    desc: "帳簿と実際有高のズレを調整する仕訳です。",
    questions: [
      {
        id: "jb4-q1", format: "journalBlank", blankSide: "debit",
        prompt: "現金の実際有高を調べたところ、帳簿残高より3,000円少なかった。",
        rows: [{ debitAnswer: "現金過不足", debitAmount: 3000, creditAnswer: "現金", creditAmount: 3000 }],
        choices: ["現金過不足", "雑損", "雑益", "仮払金"],
        explanation: "帳簿を実際有高に合わせて現金を減らし、原因が分かるまで現金過不足で受け止めます。",
      },
      {
        id: "jb4-q2", format: "journalBlank", blankSide: "debit",
        prompt: "決算日になっても、現金過不足の借方残高2,000円の原因が判明しなかった。",
        rows: [{ debitAnswer: "雑損", debitAmount: 2000, creditAnswer: "現金過不足", creditAmount: 2000 }],
        choices: ["雑損", "雑益", "雑費", "支払手数料"],
        explanation: "現金過不足は決算に残せません。不足のままなので雑損（費用）に振り替えます。",
      },
      {
        id: "jb4-q3", format: "journalBlank", blankSide: "credit",
        prompt: "現金の実際有高を調べたところ、帳簿残高より1,500円多かった。",
        rows: [{ debitAnswer: "現金", debitAmount: 1500, creditAnswer: "現金過不足", creditAmount: 1500 }],
        choices: ["現金過不足", "雑益", "雑損", "仮受金"],
        explanation: "帳簿を実際有高に合わせて現金を増やし、原因が分かるまで現金過不足で受け止めます。",
      },
      {
        id: "jb4-q4", format: "journalBlank", blankSide: "credit",
        prompt: "決算日になっても、現金過不足の貸方残高1,500円の原因が判明しなかった。",
        rows: [{ debitAnswer: "現金過不足", debitAmount: 1500, creditAnswer: "雑益", creditAmount: 1500 }],
        choices: ["雑益", "雑損", "受取手数料", "雑費"],
        explanation: "現金が多かったままなので、雑益（収益）に振り替えて現金過不足を消します。",
      },
      {
        id: "jb4-q5", format: "journalBlank", blankSide: "debit",
        prompt: "小口現金係に小切手30,000円を振り出して前渡しした。",
        rows: [{ debitAnswer: "小口現金", debitAmount: 30000, creditAnswer: "当座預金", creditAmount: 30000 }],
        choices: ["小口現金", "現金", "普通預金", "仮払金"],
        explanation: "少額支払い用に前渡ししたお金は、小口現金（資産）として区別します。",
      },
      {
        id: "jb4-q6", format: "journalBlank", blankSide: "credit",
        prompt: "小口現金係から、通信費2,000円を支払ったとの報告を受けた。",
        rows: [{ debitAnswer: "通信費", debitAmount: 2000, creditAnswer: "小口現金", creditAmount: 2000 }],
        choices: ["小口現金", "現金", "当座預金", "貯蔵品"],
        explanation: "報告を受けて費用を計上し、その分だけ小口現金を減らします。",
      },
    ],
  },
  {
    id: "jb-b-check", title: "CHAPTER B チェック", kind: "checkpoint", chapter: "jbB",
    desc: "現金・預金の仕訳の確認テストです（合格ライン70%）。",
    questions: [
      {
        id: "jb-b-c1", format: "journalBlank", blankSide: "debit",
        prompt: "現金60,000円を普通預金に預け入れた。",
        rows: [{ debitAnswer: "普通預金", debitAmount: 60000, creditAnswer: "現金", creditAmount: 60000 }],
        choices: ["普通預金", "当座預金", "定期預金", "小口現金"],
        explanation: "普通預金（資産）の増加を借方に記入します。",
      },
      {
        id: "jb-b-c2", format: "journalBlank", blankSide: "debit",
        prompt: "現金の実際有高が帳簿残高より2,500円少なかった。",
        rows: [{ debitAnswer: "現金過不足", debitAmount: 2500, creditAnswer: "現金", creditAmount: 2500 }],
        choices: ["現金過不足", "雑損", "雑益", "仮払金"],
        explanation: "原因が分かるまで現金過不足で受け止めます。",
      },
      {
        id: "jb-b-c3", format: "journalBlank", blankSide: "credit",
        prompt: "決算日に、現金過不足の貸方残高800円の原因が判明しなかった。",
        rows: [{ debitAnswer: "現金過不足", debitAmount: 800, creditAnswer: "雑益", creditAmount: 800 }],
        choices: ["雑益", "雑損", "雑費", "受取手数料"],
        explanation: "現金が多かったままなので雑益（収益）に振り替えます。",
      },
      {
        id: "jb-b-c4", format: "journalBlank", blankSide: "credit",
        prompt: "買掛金50,000円を小切手を振り出して支払った。",
        rows: [{ debitAnswer: "買掛金", debitAmount: 50000, creditAnswer: "当座預金", creditAmount: 50000 }],
        choices: ["当座預金", "普通預金", "定期預金", "現金"],
        explanation: "小切手の振り出しは当座預金の減少です。",
      },
    ],
  },

  /* ===== CHAPTER C: 貸し借りと手形 ===== */
  {
    id: "jb5", title: "手形と電子記録債権債務", kind: "concept", chapter: "jbC",
    desc: "手形の受け取り・振り出しと、その決済の仕訳です。",
    questions: [
      {
        id: "jb5-q1", format: "journalBlank", blankSide: "debit",
        prompt: "商品50,000円を売り上げ、代金は約束手形で受け取った。",
        rows: [{ debitAnswer: "受取手形", debitAmount: 50000, creditAnswer: "売上", creditAmount: 50000 }],
        choices: ["受取手形", "支払手形", "売掛金", "電子記録債権"],
        explanation: "手形代金を受け取る権利が生じます。受取手形（資産）の増加を借方に記入します。",
      },
      {
        id: "jb5-q2", format: "journalBlank", blankSide: "credit",
        prompt: "商品40,000円を仕入れ、代金は約束手形を振り出して支払った。",
        rows: [{ debitAnswer: "仕入", debitAmount: 40000, creditAnswer: "支払手形", creditAmount: 40000 }],
        choices: ["支払手形", "受取手形", "買掛金", "電子記録債務"],
        explanation: "手形代金を後で支払う義務が生じます。支払手形（負債）の増加を貸方に記入します。",
      },
      {
        id: "jb5-q3", format: "journalBlank", blankSide: "credit",
        prompt: "受取手形50,000円が満期になり、当座預金口座に入金された。",
        rows: [{ debitAnswer: "当座預金", debitAmount: 50000, creditAnswer: "受取手形", creditAmount: 50000 }],
        choices: ["受取手形", "支払手形", "売掛金", "電子記録債権"],
        explanation: "代金を受け取ったので権利は消えます。受取手形の減少を貸方に記入します。",
      },
      {
        id: "jb5-q4", format: "journalBlank", blankSide: "debit",
        prompt: "支払手形40,000円が満期になり、当座預金口座から支払われた。",
        rows: [{ debitAnswer: "支払手形", debitAmount: 40000, creditAnswer: "当座預金", creditAmount: 40000 }],
        choices: ["支払手形", "受取手形", "買掛金", "電子記録債務"],
        explanation: "代金を支払ったので義務は消えます。支払手形の減少を借方に記入します。",
      },
      {
        id: "jb5-q5", format: "journalBlank", blankSide: "debit",
        prompt: "売掛金30,000円について、電子記録債権の発生記録が行われた。",
        rows: [{ debitAnswer: "電子記録債権", debitAmount: 30000, creditAnswer: "売掛金", creditAmount: 30000 }],
        choices: ["電子記録債権", "電子記録債務", "受取手形", "支払手形"],
        explanation: "売掛金が電子記録債権に姿を変えます。電子記録債権（資産）の増加を借方に記入します。",
      },
      {
        id: "jb5-q6", format: "journalBlank", blankSide: "credit",
        prompt: "買掛金20,000円について、電子記録債務の発生記録が行われた。",
        rows: [{ debitAnswer: "買掛金", debitAmount: 20000, creditAnswer: "電子記録債務", creditAmount: 20000 }],
        choices: ["電子記録債務", "電子記録債権", "支払手形", "受取手形"],
        explanation: "買掛金が電子記録債務に姿を変えます。電子記録債務（負債）の増加を貸方に記入します。",
      },
    ],
  },
  {
    id: "jb6", title: "貸し借りと商品以外の売買", kind: "concept", chapter: "jbC",
    desc: "貸付金・借入金と、備品などの代金のやりとりです。",
    questions: [
      {
        id: "jb6-q1", format: "journalBlank", blankSide: "debit",
        prompt: "取引先に現金200,000円を貸し付けた。",
        rows: [{ debitAnswer: "貸付金", debitAmount: 200000, creditAnswer: "現金", creditAmount: 200000 }],
        choices: ["貸付金", "借入金", "未収入金", "立替金"],
        explanation: "返してもらう権利が生じます。貸付金（資産）の増加を借方に記入します。",
      },
      {
        id: "jb6-q2", format: "journalBlank", blankSide: "credit",
        prompt: "銀行から200,000円を借り入れ、普通預金口座に入金された。",
        rows: [{ debitAnswer: "普通預金", debitAmount: 200000, creditAnswer: "借入金", creditAmount: 200000 }],
        choices: ["借入金", "貸付金", "未払金", "仮受金"],
        explanation: "返す義務が生じます。借入金（負債）の増加を貸方に記入します。",
      },
      {
        id: "jb6-q3", format: "journalBlank", blankSide: "credit",
        prompt: "貸付金の利息3,000円を現金で受け取った。",
        rows: [{ debitAnswer: "現金", debitAmount: 3000, creditAnswer: "受取利息", creditAmount: 3000 }],
        choices: ["受取利息", "支払利息", "受取手数料", "雑益"],
        explanation: "現金が増えた理由は利息の受け取りです。受取利息（収益）を貸方に記入します。",
      },
      {
        id: "jb6-q4", format: "journalBlank", blankSide: "debit",
        prompt: "借入金の利息2,000円を普通預金口座から支払った。",
        rows: [{ debitAnswer: "支払利息", debitAmount: 2000, creditAnswer: "普通預金", creditAmount: 2000 }],
        choices: ["支払利息", "受取利息", "支払手数料", "雑損"],
        explanation: "預金が減った理由は利息の支払いです。支払利息（費用）を借方に記入します。",
      },
      {
        id: "jb6-q5", format: "journalBlank", blankSide: "debit",
        prompt: "帳簿価額50,000円の備品を50,000円で売却し、代金は月末に受け取ることにした。",
        rows: [{ debitAnswer: "未収入金", debitAmount: 50000, creditAnswer: "備品", creditAmount: 50000 }],
        choices: ["未収入金", "未払金", "売掛金", "買掛金"],
        explanation: "商品以外の売却代金なので、売掛金ではなく未収入金（資産）を使います。",
      },
      {
        id: "jb6-q6", format: "journalBlank", blankSide: "credit",
        prompt: "事務用パソコン100,000円を購入し、代金は月末に支払うことにした。",
        rows: [{ debitAnswer: "備品", debitAmount: 100000, creditAnswer: "未払金", creditAmount: 100000 }],
        choices: ["未払金", "未収入金", "買掛金", "売掛金"],
        explanation: "商品以外の購入代金なので、買掛金ではなく未払金（負債）を使います。",
      },
    ],
  },
  {
    id: "jb-c-check", title: "CHAPTER C チェック", kind: "checkpoint", chapter: "jbC",
    desc: "貸し借りと手形の仕訳の確認テストです（合格ライン70%）。",
    questions: [
      {
        id: "jb-c-c1", format: "journalBlank", blankSide: "credit",
        prompt: "商品35,000円を仕入れ、代金は約束手形を振り出して支払った。",
        rows: [{ debitAnswer: "仕入", debitAmount: 35000, creditAnswer: "支払手形", creditAmount: 35000 }],
        choices: ["支払手形", "受取手形", "買掛金", "電子記録債務"],
        explanation: "手形代金を後で支払う義務なので、支払手形（負債）を貸方に記入します。",
      },
      {
        id: "jb-c-c2", format: "journalBlank", blankSide: "debit",
        prompt: "売掛金25,000円について、電子記録債権の発生記録が行われた。",
        rows: [{ debitAnswer: "電子記録債権", debitAmount: 25000, creditAnswer: "売掛金", creditAmount: 25000 }],
        choices: ["電子記録債権", "電子記録債務", "受取手形", "支払手形"],
        explanation: "売掛金が電子記録債権に姿を変えます。",
      },
      {
        id: "jb-c-c3", format: "journalBlank", blankSide: "credit",
        prompt: "備品80,000円を購入し、代金は月末に支払うことにした。",
        rows: [{ debitAnswer: "備品", debitAmount: 80000, creditAnswer: "未払金", creditAmount: 80000 }],
        choices: ["未払金", "買掛金", "未収入金", "借入金"],
        explanation: "商品以外の購入代金なので未払金を使います。",
      },
      {
        id: "jb-c-c4", format: "journalBlank", blankSide: "debit",
        prompt: "借入金の利息1,500円を現金で支払った。",
        rows: [{ debitAnswer: "支払利息", debitAmount: 1500, creditAnswer: "現金", creditAmount: 1500 }],
        choices: ["支払利息", "受取利息", "支払手数料", "雑損"],
        explanation: "利息の支払いは支払利息（費用）です。",
      },
    ],
  },

  /* ===== CHAPTER D: 従業員とお金 ===== */
  {
    id: "jb7", title: "給料と預り金", kind: "concept", chapter: "jbD",
    desc: "天引きして預かるお金と、会社負担分の仕訳です。",
    questions: [
      {
        id: "jb7-q1", format: "journalBlank", blankSide: "credit",
        prompt: "給料200,000円のうち所得税15,000円を差し引き、残額を現金で支払った。",
        rows: [
          { debitAnswer: "給料", debitAmount: 200000, creditAnswer: "所得税預り金", creditAmount: 15000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "現金", creditAmount: 185000 },
        ],
        choices: ["所得税預り金", "現金", "従業員立替金", "社会保険料預り金"],
        explanation: "給料の総額を借方に立て、天引き分は預り金、手取り分は現金として貸方に分けます。",
      },
      {
        id: "jb7-q2", format: "journalBlank", blankSide: "debit",
        prompt: "預かっていた所得税15,000円を現金で納付した。",
        rows: [{ debitAnswer: "所得税預り金", debitAmount: 15000, creditAnswer: "現金", creditAmount: 15000 }],
        choices: ["所得税預り金", "社会保険料預り金", "従業員立替金", "租税公課"],
        explanation: "納付によって預かっていた義務が消えます。所得税預り金の減少を借方に記入します。",
      },
      {
        id: "jb7-q3", format: "journalBlank", blankSide: "debit",
        prompt: "社会保険料の会社負担分12,000円を普通預金口座から納付した。",
        rows: [{ debitAnswer: "法定福利費", debitAmount: 12000, creditAnswer: "普通預金", creditAmount: 12000 }],
        choices: ["法定福利費", "給料", "租税公課", "支払保険料"],
        explanation: "会社が負担する社会保険料は、法定福利費（費用）で処理します。",
      },
      {
        id: "jb7-q4", format: "journalBlank", blankSide: "debit",
        prompt: "従業員が負担すべき保険料5,000円を現金で立て替えて支払った。",
        rows: [{ debitAnswer: "従業員立替金", debitAmount: 5000, creditAnswer: "現金", creditAmount: 5000 }],
        choices: ["従業員立替金", "従業員預り金", "支払保険料", "仮払金"],
        explanation: "後で従業員から返してもらう権利なので、従業員立替金（資産）で処理します。",
      },
      {
        id: "jb7-q5", format: "journalBlank", blankSide: "credit",
        prompt: "給料150,000円のうち社会保険料12,000円を差し引き、残額を普通預金から支払った。",
        rows: [
          { debitAnswer: "給料", debitAmount: 150000, creditAnswer: "社会保険料預り金", creditAmount: 12000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "普通預金", creditAmount: 138000 },
        ],
        choices: ["社会保険料預り金", "普通預金", "所得税預り金", "現金"],
        explanation: "天引きした社会保険料は預り金（負債）、手取り分は普通預金の減少です。",
      },
      {
        id: "jb7-q6", format: "journalBlank", blankSide: "debit",
        prompt: "預かった社会保険料12,000円と会社負担分12,000円を、あわせて普通預金から納付した。",
        rows: [
          { debitAnswer: "社会保険料預り金", debitAmount: 12000, creditAnswer: "普通預金", creditAmount: 24000 },
          { debitAnswer: "法定福利費", debitAmount: 12000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["社会保険料預り金", "法定福利費", "所得税預り金", "租税公課"],
        explanation: "預かっていた分は預り金の減少、会社が負担する分は法定福利費（費用）です。",
      },
      {
        id: "jb7-q7", format: "journalBlank", blankSide: "credit",
        prompt: "給料250,000円のうち、所得税18,000円と社会保険料20,000円を差し引き、残額を普通預金から支払った。",
        rows: [
          { debitAnswer: "給料", debitAmount: 250000, creditAnswer: "所得税預り金", creditAmount: 18000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "社会保険料預り金", creditAmount: 20000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "普通預金", creditAmount: 212000 },
        ],
        choices: ["所得税預り金", "社会保険料預り金", "普通預金", "従業員立替金", "法定福利費"],
        explanation: "借方は給料の総額250,000円。貸方は天引きした2つの預り金と、手取り212,000円の普通預金に分かれます。",
      },
    ],
  },
  {
    id: "jb8", title: "仮払金と仮受金", kind: "concept", chapter: "jbD",
    desc: "内容が決まる前にいったん受け止め、後で振り替える仕訳です。",
    questions: [
      {
        id: "jb8-q1", format: "journalBlank", blankSide: "debit",
        prompt: "出張する従業員に、旅費の概算額20,000円を現金で前渡しした。",
        rows: [{ debitAnswer: "仮払金", debitAmount: 20000, creditAnswer: "現金", creditAmount: 20000 }],
        choices: ["仮払金", "仮受金", "旅費交通費", "立替金"],
        explanation: "金額が確定していないので、いったん仮払金（資産）で受け止めます。",
      },
      {
        id: "jb8-q2", format: "journalBlank", blankSide: "debit",
        prompt: "出張から戻り、前渡ししていた20,000円は全額が旅費であったとの報告を受けた。",
        rows: [{ debitAnswer: "旅費交通費", debitAmount: 20000, creditAnswer: "仮払金", creditAmount: 20000 }],
        choices: ["旅費交通費", "通信費", "雑費", "仮受金"],
        explanation: "内容が確定したので、仮払金から旅費交通費（費用）に振り替えます。",
      },
      {
        id: "jb8-q3", format: "journalBlank", blankSide: "credit",
        prompt: "内容不明の入金3,000円が普通預金口座にあった。",
        rows: [{ debitAnswer: "普通預金", debitAmount: 3000, creditAnswer: "仮受金", creditAmount: 3000 }],
        choices: ["仮受金", "仮払金", "前受金", "未収入金"],
        explanation: "内容が分かるまで、いったん仮受金（負債）で受け止めます。",
      },
      {
        id: "jb8-q4", format: "journalBlank", blankSide: "credit",
        prompt: "仮受金3,000円は、売掛金の回収であることが判明した。",
        rows: [{ debitAnswer: "仮受金", debitAmount: 3000, creditAnswer: "売掛金", creditAmount: 3000 }],
        choices: ["売掛金", "買掛金", "未収入金", "前受金"],
        explanation: "内容が判明したので、仮受金を消して売掛金（資産）の減少に振り替えます。",
      },
      {
        id: "jb8-q5", format: "journalBlank", blankSide: "debit",
        prompt: "従業員が立て替えていた電車代1,200円を現金で精算した。",
        rows: [{ debitAnswer: "旅費交通費", debitAmount: 1200, creditAnswer: "現金", creditAmount: 1200 }],
        choices: ["旅費交通費", "立替金", "仮払金", "通信費"],
        explanation: "会社の費用として確定しているので、旅費交通費（費用）で処理します。",
      },
      {
        id: "jb8-q6", format: "journalBlank", blankSide: "debit",
        prompt: "前渡しした仮払金20,000円のうち18,000円が旅費として使われ、残額2,000円を現金で受け取った。",
        rows: [
          { debitAnswer: "旅費交通費", debitAmount: 18000, creditAnswer: "仮払金", creditAmount: 20000 },
          { debitAnswer: "現金", debitAmount: 2000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["旅費交通費", "現金", "仮受金", "通信費"],
        explanation: "仮払金20,000円を全額消し、使った分を費用、戻った分を現金として借方に分けます。",
      },
    ],
  },
  {
    id: "jb-d-check", title: "CHAPTER D チェック", kind: "checkpoint", chapter: "jbD",
    desc: "従業員とお金の仕訳の確認テストです（合格ライン70%）。",
    questions: [
      {
        id: "jb-d-c1", format: "journalBlank", blankSide: "credit",
        prompt: "給料180,000円のうち所得税12,000円を差し引き、残額を現金で支払った。",
        rows: [
          { debitAnswer: "給料", debitAmount: 180000, creditAnswer: "所得税預り金", creditAmount: 12000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "現金", creditAmount: 168000 },
        ],
        choices: ["所得税預り金", "現金", "従業員立替金", "法定福利費"],
        explanation: "天引き分は預り金、手取り分は現金です。",
      },
      {
        id: "jb-d-c2", format: "journalBlank", blankSide: "debit",
        prompt: "社会保険料の会社負担分10,000円を現金で納付した。",
        rows: [{ debitAnswer: "法定福利費", debitAmount: 10000, creditAnswer: "現金", creditAmount: 10000 }],
        choices: ["法定福利費", "給料", "租税公課", "支払保険料"],
        explanation: "会社負担分は法定福利費（費用）です。",
      },
      {
        id: "jb-d-c3", format: "journalBlank", blankSide: "debit",
        prompt: "出張する従業員に、旅費の概算額15,000円を現金で前渡しした。",
        rows: [{ debitAnswer: "仮払金", debitAmount: 15000, creditAnswer: "現金", creditAmount: 15000 }],
        choices: ["仮払金", "仮受金", "旅費交通費", "立替金"],
        explanation: "金額が未確定なので仮払金（資産）で受け止めます。",
      },
      {
        id: "jb-d-c4", format: "journalBlank", blankSide: "credit",
        prompt: "仮受金5,000円は、売掛金の回収であることが判明した。",
        rows: [{ debitAnswer: "仮受金", debitAmount: 5000, creditAnswer: "売掛金", creditAmount: 5000 }],
        choices: ["売掛金", "買掛金", "前受金", "未収入金"],
        explanation: "内容が判明したので売掛金の減少に振り替えます。",
      },
    ],
  },

  /* ===== CHAPTER E: 会社を運営する経費 ===== */
  {
    id: "jb9", title: "経費の支払い", kind: "concept", chapter: "jbE",
    desc: "日々の経費と、決算での貯蔵品への振り替えです。",
    questions: [
      {
        id: "jb9-q1", format: "journalBlank", blankSide: "debit",
        prompt: "電気代8,000円が普通預金口座から引き落とされた。",
        rows: [{ debitAnswer: "水道光熱費", debitAmount: 8000, creditAnswer: "普通預金", creditAmount: 8000 }],
        choices: ["水道光熱費", "通信費", "消耗品費", "雑費"],
        explanation: "電気・ガス・水道の料金は水道光熱費（費用）で処理します。",
      },
      {
        id: "jb9-q2", format: "journalBlank", blankSide: "debit",
        prompt: "郵便切手5,000円分を現金で購入した。",
        rows: [{ debitAnswer: "通信費", debitAmount: 5000, creditAnswer: "現金", creditAmount: 5000 }],
        choices: ["通信費", "消耗品費", "租税公課", "発送費"],
        explanation: "切手代や電話代は通信費（費用）で処理します。",
      },
      {
        id: "jb9-q3", format: "journalBlank", blankSide: "debit",
        prompt: "収入印紙3,000円分を現金で購入した。",
        rows: [{ debitAnswer: "租税公課", debitAmount: 3000, creditAnswer: "現金", creditAmount: 3000 }],
        choices: ["租税公課", "通信費", "支払手数料", "雑費"],
        explanation: "収入印紙は印紙税にあたるので、租税公課（費用）で処理します。",
      },
      {
        id: "jb9-q4", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、未使用の切手1,000円分を貯蔵品に振り替えた。",
        rows: [{ debitAnswer: "貯蔵品", debitAmount: 1000, creditAnswer: "通信費", creditAmount: 1000 }],
        choices: ["貯蔵品", "消耗品費", "繰越商品", "租税公課"],
        explanation: "使い残しはまだ価値が残っているので、費用から貯蔵品（資産）に振り替えます。",
      },
      {
        id: "jb9-q5", format: "journalBlank", blankSide: "credit",
        prompt: "広告料50,000円について請求を受けたが、支払いは翌月とした。",
        rows: [{ debitAnswer: "広告宣伝費", debitAmount: 50000, creditAnswer: "未払金", creditAmount: 50000 }],
        choices: ["未払金", "買掛金", "未収入金", "前受金"],
        explanation: "商品以外の代金の未払いなので、買掛金ではなく未払金（負債）を使います。",
      },
      {
        id: "jb9-q6", format: "journalBlank", blankSide: "debit",
        prompt: "文房具3,000円分を現金で購入した。",
        rows: [{ debitAnswer: "消耗品費", debitAmount: 3000, creditAnswer: "現金", creditAmount: 3000 }],
        choices: ["消耗品費", "通信費", "貯蔵品", "雑費"],
        explanation: "文房具などの少額な備品は消耗品費（費用）で処理します。",
      },
    ],
  },
  {
    id: "jb10", title: "土地・建物を借りる／貸す", kind: "concept", chapter: "jbE",
    desc: "家賃・地代・敷金など、賃貸借にまつわる仕訳です。",
    questions: [
      {
        id: "jb10-q1", format: "journalBlank", blankSide: "debit",
        prompt: "店舗の家賃100,000円を普通預金口座から支払った。",
        rows: [{ debitAnswer: "支払家賃", debitAmount: 100000, creditAnswer: "普通預金", creditAmount: 100000 }],
        choices: ["支払家賃", "支払地代", "差入保証金", "修繕費"],
        explanation: "建物を借りて払う家賃は支払家賃（費用）です。",
      },
      {
        id: "jb10-q2", format: "journalBlank", blankSide: "credit",
        prompt: "所有する土地の地代30,000円を現金で受け取った。",
        rows: [{ debitAnswer: "現金", debitAmount: 30000, creditAnswer: "受取地代", creditAmount: 30000 }],
        choices: ["受取地代", "受取家賃", "支払地代", "受取手数料"],
        explanation: "土地を貸して受け取る地代は受取地代（収益）です。",
      },
      {
        id: "jb10-q3", format: "journalBlank", blankSide: "debit",
        prompt: "店舗を借りる際、敷金200,000円を普通預金口座から支払った。",
        rows: [{ debitAnswer: "差入保証金", debitAmount: 200000, creditAnswer: "普通預金", creditAmount: 200000 }],
        choices: ["差入保証金", "支払家賃", "前払費用", "修繕費"],
        explanation: "敷金は退去時に返ってくるお金なので、費用ではなく差入保証金（資産）です。",
      },
      {
        id: "jb10-q4", format: "journalBlank", blankSide: "debit",
        prompt: "建物の破損部分を元の状態に戻すため、修繕費用80,000円を現金で支払った。",
        rows: [{ debitAnswer: "修繕費", debitAmount: 80000, creditAnswer: "現金", creditAmount: 80000 }],
        choices: ["修繕費", "建物", "消耗品費", "支払手数料"],
        explanation: "元の状態に戻すだけの支出は資産に加えず、修繕費（費用）で処理します。",
      },
      {
        id: "jb10-q5", format: "journalBlank", blankSide: "credit",
        prompt: "所有する建物の家賃50,000円が普通預金口座に入金された。",
        rows: [{ debitAnswer: "普通預金", debitAmount: 50000, creditAnswer: "受取家賃", creditAmount: 50000 }],
        choices: ["受取家賃", "受取地代", "支払家賃", "受取手数料"],
        explanation: "建物を貸して受け取る家賃は受取家賃（収益）です。",
      },
      {
        id: "jb10-q6", format: "journalBlank", blankSide: "debit",
        prompt: "火災保険料24,000円を現金で支払った。",
        rows: [{ debitAnswer: "支払保険料", debitAmount: 24000, creditAnswer: "現金", creditAmount: 24000 }],
        choices: ["支払保険料", "支払手数料", "租税公課", "雑費"],
        explanation: "保険料の支払いは支払保険料（費用）です。",
      },
    ],
  },
  {
    id: "jb-e-check", title: "CHAPTER E チェック", kind: "checkpoint", chapter: "jbE",
    desc: "経費の仕訳の確認テストです（合格ライン70%）。",
    questions: [
      {
        id: "jb-e-c1", format: "journalBlank", blankSide: "debit",
        prompt: "収入印紙2,000円分を現金で購入した。",
        rows: [{ debitAnswer: "租税公課", debitAmount: 2000, creditAnswer: "現金", creditAmount: 2000 }],
        choices: ["租税公課", "通信費", "消耗品費", "支払手数料"],
        explanation: "収入印紙は印紙税にあたるので租税公課（費用）です。",
      },
      {
        id: "jb-e-c2", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、未使用の収入印紙500円分を貯蔵品に振り替えた。",
        rows: [{ debitAnswer: "貯蔵品", debitAmount: 500, creditAnswer: "租税公課", creditAmount: 500 }],
        choices: ["貯蔵品", "繰越商品", "消耗品費", "通信費"],
        explanation: "使い残しは価値が残っているので貯蔵品（資産）に振り替えます。",
      },
      {
        id: "jb-e-c3", format: "journalBlank", blankSide: "debit",
        prompt: "店舗を借りる際、敷金150,000円を現金で支払った。",
        rows: [{ debitAnswer: "差入保証金", debitAmount: 150000, creditAnswer: "現金", creditAmount: 150000 }],
        choices: ["差入保証金", "支払家賃", "前払費用", "立替金"],
        explanation: "敷金は返ってくるお金なので差入保証金（資産）です。",
      },
      {
        id: "jb-e-c4", format: "journalBlank", blankSide: "credit",
        prompt: "広告料30,000円について請求を受けたが、支払いは翌月とした。",
        rows: [{ debitAnswer: "広告宣伝費", debitAmount: 30000, creditAnswer: "未払金", creditAmount: 30000 }],
        choices: ["未払金", "買掛金", "前受金", "未収入金"],
        explanation: "商品以外の未払いなので未払金（負債）です。",
      },
    ],
  },

  /* ===== CHAPTER F: 固定資産を持つ ===== */
  {
    id: "jb11", title: "固定資産の購入と売却", kind: "concept", chapter: "jbF",
    desc: "取得原価の考え方と、売却損益の出し方です。",
    questions: [
      {
        id: "jb11-q1", format: "journalBlank", blankSide: "debit",
        prompt: "備品300,000円を購入し、代金は現金で支払った。",
        rows: [{ debitAnswer: "備品", debitAmount: 300000, creditAnswer: "現金", creditAmount: 300000 }],
        choices: ["備品", "建物", "土地", "消耗品費"],
        explanation: "長く使う物なので費用ではなく、備品（資産）として計上します。",
      },
      {
        id: "jb11-q2", format: "journalBlank", blankSide: "debit",
        prompt: "建物2,000,000円を購入し、代金は小切手を振り出して支払った。",
        rows: [{ debitAnswer: "建物", debitAmount: 2000000, creditAnswer: "当座預金", creditAmount: 2000000 }],
        choices: ["建物", "土地", "備品", "修繕費"],
        explanation: "建物（資産）の増加を借方に記入します。",
      },
      {
        id: "jb11-q3", format: "journalBlank", blankSide: "debit",
        prompt: "備品200,000円を購入し、設置費用10,000円とあわせて現金で支払った。設置費用は取得原価に含める。",
        rows: [{ debitAnswer: "備品", debitAmount: 210000, creditAnswer: "現金", creditAmount: 210000 }],
        choices: ["備品", "修繕費", "消耗品費", "支払手数料"],
        explanation: "使えるようにするための費用は取得原価に含めるので、合計210,000円が備品になります。",
      },
      {
        id: "jb11-q4", format: "journalBlank", blankSide: "credit",
        prompt: "土地500,000円を購入し、代金は月末に支払うことにした。",
        rows: [{ debitAnswer: "土地", debitAmount: 500000, creditAnswer: "未払金", creditAmount: 500000 }],
        choices: ["未払金", "買掛金", "未収入金", "借入金"],
        explanation: "商品以外の購入代金なので未払金（負債）を使います。",
      },
      {
        id: "jb11-q5", format: "journalBlank", blankSide: "credit",
        prompt: "帳簿価額80,000円の備品を80,000円で売却し、代金は現金で受け取った。",
        rows: [{ debitAnswer: "現金", debitAmount: 80000, creditAnswer: "備品", creditAmount: 80000 }],
        choices: ["備品", "土地", "建物", "未収入金"],
        explanation: "帳簿価額と同額で売れたので損益は出ません。備品（資産）の減少を貸方に記入します。",
      },
      {
        id: "jb11-q6", format: "journalBlank", blankSide: "credit",
        prompt: "帳簿価額100,000円の土地を120,000円で売却し、代金は現金で受け取った。",
        rows: [
          { debitAnswer: "現金", debitAmount: 120000, creditAnswer: "土地", creditAmount: 100000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "固定資産売却益", creditAmount: 20000 },
        ],
        choices: ["土地", "固定資産売却益", "固定資産売却損", "建物"],
        explanation: "帳簿価額100,000円を消し、高く売れた差額20,000円が固定資産売却益（収益）になります。",
      },
    ],
  },
  {
    id: "jb12", title: "減価償却", kind: "concept", chapter: "jbF",
    desc: "間接法での減価償却と、償却済み資産の売却です。",
    questions: [
      {
        id: "jb12-q1", format: "journalBlank", blankSide: "credit",
        prompt: "決算にあたり、建物の減価償却費90,000円を間接法で計上した。",
        rows: [{ debitAnswer: "減価償却費", debitAmount: 90000, creditAnswer: "減価償却累計額", creditAmount: 90000 }],
        choices: ["減価償却累計額", "建物", "備品", "固定資産売却損"],
        explanation: "間接法では建物を直接減らさず、減価償却累計額に積み上げていきます。",
      },
      {
        id: "jb12-q2", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、備品の減価償却費50,000円を間接法で計上した。",
        rows: [{ debitAnswer: "減価償却費", debitAmount: 50000, creditAnswer: "減価償却累計額", creditAmount: 50000 }],
        choices: ["減価償却費", "修繕費", "固定資産売却損", "消耗品費"],
        explanation: "その年の価値の減少分は減価償却費（費用）として借方に計上します。",
      },
      {
        id: "jb12-q3", format: "journalBlank", blankSide: "debit",
        prompt: "取得原価200,000円・減価償却累計額120,000円の備品を、80,000円で売却し現金を受け取った。",
        rows: [
          { debitAnswer: "減価償却累計額", debitAmount: 120000, creditAnswer: "備品", creditAmount: 200000 },
          { debitAnswer: "現金", debitAmount: 80000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["減価償却累計額", "現金", "減価償却費", "固定資産売却損"],
        explanation: "備品を取得原価で消すと同時に、積み上げた累計額も借方で消します。帳簿価額80,000円と同額なので損益は出ません。",
      },
      {
        id: "jb12-q4", format: "journalBlank", blankSide: "debit",
        prompt: "取得原価200,000円・減価償却累計額120,000円の備品を、60,000円で売却し現金を受け取った。",
        rows: [
          { debitAnswer: "減価償却累計額", debitAmount: 120000, creditAnswer: "備品", creditAmount: 200000 },
          { debitAnswer: "現金", debitAmount: 60000, creditAnswer: null, creditAmount: 0 },
          { debitAnswer: "固定資産売却損", debitAmount: 20000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["減価償却累計額", "現金", "固定資産売却損", "固定資産売却益", "減価償却費"],
        explanation: "貸方は取得原価200,000円で備品を消します。借方は積み上げた累計額120,000円の取り崩しと受け取った現金60,000円、差額20,000円が固定資産売却損です。",
      },
      {
        id: "jb12-q5", format: "journalBlank", blankSide: "debit",
        prompt: "営業用の車両600,000円を購入し、代金は小切手を振り出して支払った。",
        rows: [{ debitAnswer: "車両運搬具", debitAmount: 600000, creditAnswer: "当座預金", creditAmount: 600000 }],
        choices: ["車両運搬具", "備品", "建物", "土地"],
        explanation: "営業車は車両運搬具（資産）として計上します。",
      },
      {
        id: "jb12-q6", format: "journalBlank", blankSide: "credit",
        prompt: "取得原価200,000円・減価償却累計額160,000円の備品を、50,000円で売却し現金を受け取った。",
        rows: [
          { debitAnswer: "減価償却累計額", debitAmount: 160000, creditAnswer: "備品", creditAmount: 200000 },
          { debitAnswer: "現金", debitAmount: 50000, creditAnswer: "固定資産売却益", creditAmount: 10000 },
        ],
        choices: ["備品", "固定資産売却益", "固定資産売却損", "土地"],
        explanation: "帳簿価額40,000円より高く売れたため、差額10,000円が固定資産売却益（収益）になります。",
      },
      {
        id: "jb12-q7", format: "journalBlank", blankSide: "debit",
        prompt: "取得原価500,000円・減価償却累計額300,000円の車両を、150,000円で売却し、代金は月末に受け取ることにした。",
        rows: [
          { debitAnswer: "減価償却累計額", debitAmount: 300000, creditAnswer: "車両運搬具", creditAmount: 500000 },
          { debitAnswer: "未収入金", debitAmount: 150000, creditAnswer: null, creditAmount: 0 },
          { debitAnswer: "固定資産売却損", debitAmount: 50000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["減価償却累計額", "未収入金", "固定資産売却損", "未払金", "固定資産売却益"],
        explanation: "帳簿価額は500,000−300,000＝200,000円です。150,000円でしか売れなかったので差額50,000円が売却損。代金は後日受け取るため未収入金を使います。",
      },
    ],
  },
  {
    id: "jb-f-check", title: "CHAPTER F チェック", kind: "checkpoint", chapter: "jbF",
    desc: "固定資産の仕訳の確認テストです（合格ライン70%）。",
    questions: [
      {
        id: "jb-f-c1", format: "journalBlank", blankSide: "debit",
        prompt: "備品150,000円を購入し、設置費用5,000円とあわせて現金で支払った。設置費用は取得原価に含める。",
        rows: [{ debitAnswer: "備品", debitAmount: 155000, creditAnswer: "現金", creditAmount: 155000 }],
        choices: ["備品", "修繕費", "消耗品費", "支払手数料"],
        explanation: "使えるようにするための費用も取得原価に含めます。",
      },
      {
        id: "jb-f-c2", format: "journalBlank", blankSide: "credit",
        prompt: "決算にあたり、備品の減価償却費40,000円を間接法で計上した。",
        rows: [{ debitAnswer: "減価償却費", debitAmount: 40000, creditAnswer: "減価償却累計額", creditAmount: 40000 }],
        choices: ["減価償却累計額", "備品", "建物", "固定資産売却損"],
        explanation: "間接法では備品を直接減らさず、減価償却累計額に積み上げます。",
      },
      {
        id: "jb-f-c3", format: "journalBlank", blankSide: "credit",
        prompt: "帳簿価額200,000円の土地を250,000円で売却し、代金は現金で受け取った。",
        rows: [
          { debitAnswer: "現金", debitAmount: 250000, creditAnswer: "土地", creditAmount: 200000 },
          { debitAnswer: null, debitAmount: 0, creditAnswer: "固定資産売却益", creditAmount: 50000 },
        ],
        choices: ["土地", "固定資産売却益", "固定資産売却損", "建物"],
        explanation: "高く売れた差額50,000円が固定資産売却益です。",
      },
      {
        id: "jb-f-c4", format: "journalBlank", blankSide: "debit",
        prompt: "取得原価300,000円・減価償却累計額180,000円の備品を、100,000円で売却し現金を受け取った。",
        rows: [
          { debitAnswer: "減価償却累計額", debitAmount: 180000, creditAnswer: "備品", creditAmount: 300000 },
          { debitAnswer: "現金", debitAmount: 100000, creditAnswer: null, creditAmount: 0 },
          { debitAnswer: "固定資産売却損", debitAmount: 20000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["減価償却累計額", "現金", "固定資産売却損", "固定資産売却益", "減価償却費"],
        explanation: "帳簿価額は300,000−180,000＝120,000円。100,000円で売れたので差額20,000円が売却損です。",
      },
    ],
  },

  /* ===== CHAPTER G: 決算で整理する ===== */
  {
    id: "jb13", title: "貸倒引当金", kind: "concept", chapter: "jbG",
    desc: "貸倒れへの備えと、実際に貸し倒れたときの仕訳です。",
    questions: [
      {
        id: "jb13-q1", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、売掛金に対して貸倒引当金3,000円を設定した。",
        rows: [{ debitAnswer: "貸倒引当金繰入", debitAmount: 3000, creditAnswer: "貸倒引当金", creditAmount: 3000 }],
        choices: ["貸倒引当金繰入", "貸倒損失", "貸倒引当金戻入", "償却債権取立益"],
        explanation: "備えを積むための費用は貸倒引当金繰入です。相手科目の貸倒引当金と混同しないよう注意します。",
      },
      {
        id: "jb13-q2", format: "journalBlank", blankSide: "debit",
        prompt: "前期に発生した売掛金5,000円が貸し倒れた。貸倒引当金の残高は8,000円である。",
        rows: [{ debitAnswer: "貸倒引当金", debitAmount: 5000, creditAnswer: "売掛金", creditAmount: 5000 }],
        choices: ["貸倒引当金", "貸倒損失", "貸倒引当金繰入", "償却債権取立益"],
        explanation: "備えが足りているので、費用は出さず貸倒引当金を取り崩します。",
      },
      {
        id: "jb13-q3", format: "journalBlank", blankSide: "debit",
        prompt: "当期に発生した売掛金4,000円が貸し倒れた。貸倒引当金は設定されていない。",
        rows: [{ debitAnswer: "貸倒損失", debitAmount: 4000, creditAnswer: "売掛金", creditAmount: 4000 }],
        choices: ["貸倒損失", "貸倒引当金", "貸倒引当金繰入", "雑損"],
        explanation: "備えがないため、その期の費用として貸倒損失を計上します。",
      },
      {
        id: "jb13-q4", format: "journalBlank", blankSide: "credit",
        prompt: "前期に貸倒れとして処理した売掛金2,000円を、現金で回収した。",
        rows: [{ debitAnswer: "現金", debitAmount: 2000, creditAnswer: "償却債権取立益", creditAmount: 2000 }],
        choices: ["償却債権取立益", "貸倒引当金戻入", "雑益", "受取手数料"],
        explanation: "すでに消した債権が戻ってきたので、償却債権取立益（収益）で処理します。",
      },
      {
        id: "jb13-q5", format: "journalBlank", blankSide: "credit",
        prompt: "決算にあたり、貸倒引当金が1,000円多すぎたため戻し入れた。",
        rows: [{ debitAnswer: "貸倒引当金", debitAmount: 1000, creditAnswer: "貸倒引当金戻入", creditAmount: 1000 }],
        choices: ["貸倒引当金戻入", "償却債権取立益", "雑益", "貸倒引当金繰入"],
        explanation: "積みすぎた備えを取り消すので、貸倒引当金戻入（収益）を貸方に記入します。",
      },
      {
        id: "jb13-q6", format: "journalBlank", blankSide: "debit",
        prompt: "前期に発生した売掛金10,000円が貸し倒れた。貸倒引当金の残高は6,000円である。",
        rows: [
          { debitAnswer: "貸倒引当金", debitAmount: 6000, creditAnswer: "売掛金", creditAmount: 10000 },
          { debitAnswer: "貸倒損失", debitAmount: 4000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["貸倒引当金", "貸倒損失", "貸倒引当金繰入", "雑損"],
        explanation: "備えの6,000円をまず取り崩し、足りない4,000円だけを貸倒損失（費用）にします。",
      },
    ],
  },
  {
    id: "jb14", title: "売上原価と経過勘定", kind: "concept", chapter: "jbG",
    desc: "しーくりくりしーと、費用・収益の期ズレ調整です。",
    questions: [
      {
        id: "jb14-q1", format: "journalBlank", blankSide: "credit",
        prompt: "決算にあたり、期首商品棚卸高30,000円を仕入勘定に振り替えた。",
        rows: [{ debitAnswer: "仕入", debitAmount: 30000, creditAnswer: "繰越商品", creditAmount: 30000 }],
        choices: ["繰越商品", "商品", "売上原価", "貯蔵品"],
        explanation: "前期から繰り越した商品を当期の仕入に加えます。繰越商品（資産）の減少を貸方に記入します。",
      },
      {
        id: "jb14-q2", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、期末商品棚卸高40,000円を仕入勘定から振り替えた。",
        rows: [{ debitAnswer: "繰越商品", debitAmount: 40000, creditAnswer: "仕入", creditAmount: 40000 }],
        choices: ["繰越商品", "商品", "売上原価", "貯蔵品"],
        explanation: "売れ残った分は当期の費用から除きます。繰越商品（資産）の増加を借方に記入します。",
      },
      {
        id: "jb14-q3", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、支払家賃のうち次期分12,000円を繰り延べた。",
        rows: [{ debitAnswer: "前払費用", debitAmount: 12000, creditAnswer: "支払家賃", creditAmount: 12000 }],
        choices: ["前払費用", "前受収益", "未払費用", "未収収益"],
        explanation: "次期分の費用を当期から取り除き、前払費用（資産）として繰り延べます。",
      },
      {
        id: "jb14-q4", format: "journalBlank", blankSide: "credit",
        prompt: "決算にあたり、当期分の利息3,000円が未払いであることが判明した。",
        rows: [{ debitAnswer: "支払利息", debitAmount: 3000, creditAnswer: "未払費用", creditAmount: 3000 }],
        choices: ["未払費用", "前払費用", "未収収益", "前受収益"],
        explanation: "発生済みでまだ払っていない分を、未払費用（負債）として計上します。",
      },
      {
        id: "jb14-q5", format: "journalBlank", blankSide: "credit",
        prompt: "決算にあたり、受取地代のうち次期分9,000円を繰り延べた。",
        rows: [{ debitAnswer: "受取地代", debitAmount: 9000, creditAnswer: "前受収益", creditAmount: 9000 }],
        choices: ["前受収益", "前払費用", "未収収益", "未払費用"],
        explanation: "次期分の収益を当期から取り除き、前受収益（負債）として繰り延べます。",
      },
      {
        id: "jb14-q6", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、当期分の受取利息2,000円が未収であることが判明した。",
        rows: [{ debitAnswer: "未収収益", debitAmount: 2000, creditAnswer: "受取利息", creditAmount: 2000 }],
        choices: ["未収収益", "未払費用", "前払費用", "前受収益"],
        explanation: "発生済みでまだ受け取っていない分を、未収収益（資産）として計上します。",
      },
    ],
  },
  {
    id: "jb-g-check", title: "CHAPTER G チェック", kind: "checkpoint", chapter: "jbG",
    desc: "決算整理の仕訳の確認テストです（合格ライン70%）。",
    questions: [
      {
        id: "jb-g-c1", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、売掛金に対して貸倒引当金2,500円を設定した。",
        rows: [{ debitAnswer: "貸倒引当金繰入", debitAmount: 2500, creditAnswer: "貸倒引当金", creditAmount: 2500 }],
        choices: ["貸倒引当金繰入", "貸倒損失", "貸倒引当金戻入", "雑損"],
        explanation: "備えを積むための費用は貸倒引当金繰入です。",
      },
      {
        id: "jb-g-c2", format: "journalBlank", blankSide: "debit",
        prompt: "前期に発生した売掛金8,000円が貸し倒れた。貸倒引当金の残高は5,000円である。",
        rows: [
          { debitAnswer: "貸倒引当金", debitAmount: 5000, creditAnswer: "売掛金", creditAmount: 8000 },
          { debitAnswer: "貸倒損失", debitAmount: 3000, creditAnswer: null, creditAmount: 0 },
        ],
        choices: ["貸倒引当金", "貸倒損失", "貸倒引当金繰入", "雑損"],
        explanation: "備えを取り崩し、足りない分だけを貸倒損失にします。",
      },
      {
        id: "jb-g-c3", format: "journalBlank", blankSide: "debit",
        prompt: "決算にあたり、期末商品棚卸高35,000円を仕入勘定から振り替えた。",
        rows: [{ debitAnswer: "繰越商品", debitAmount: 35000, creditAnswer: "仕入", creditAmount: 35000 }],
        choices: ["繰越商品", "商品", "貯蔵品", "売上原価"],
        explanation: "売れ残った分は繰越商品（資産）として次期に繰り越します。",
      },
      {
        id: "jb-g-c4", format: "journalBlank", blankSide: "credit",
        prompt: "決算にあたり、当期分の家賃5,000円が未払いであることが判明した。",
        rows: [{ debitAnswer: "支払家賃", debitAmount: 5000, creditAnswer: "未払費用", creditAmount: 5000 }],
        choices: ["未払費用", "前払費用", "前受収益", "未収収益"],
        explanation: "発生済みでまだ払っていない分は未払費用（負債）です。",
      },
    ],
  },
];

/* ---------------------------------------------------------
   コース2: TAC出版準拠コース（教科書の章立て）
--------------------------------------------------------- */

const TAC_CHAPTERS = {
  ch1: { title: "CHAPTER 01", subtitle: "簿記の基礎", bg: "bg-indigo-500", sub: "text-indigo-100" },
  ch2: { title: "CHAPTER 02", subtitle: "商品売買", bg: "bg-violet-500", sub: "text-violet-100" },
};

const TAC_NODES = [
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

/* ---------------------------------------------------------
   コース3: 思考パターン別コース

   TAC目次のような単元別ではなく、「なぜその仕訳になるのか」という
   判断の型でグルーピングした構成（このアプリ独自の分類）。
   パターン1: 交換取引（資産⇄資産・負債⇄負債の入れ替えのみ）
   パターン2: 損益取引（収益・費用が発生する）
   パターン3: 一時的な勘定科目（内容・金額が未確定なものを仮に受け止める）
   ※ 見越し・繰延べ／資産の振替パターンは準備中
--------------------------------------------------------- */

const PATTERN_CHAPTERS = {
  pat1: { title: "パターン 1", subtitle: "交換取引", bg: "bg-rose-500", sub: "text-rose-100" },
  pat2: { title: "パターン 2", subtitle: "損益取引", bg: "bg-orange-500", sub: "text-orange-100" },
  pat3: { title: "パターン 3", subtitle: "一時的な勘定科目", bg: "bg-fuchsia-500", sub: "text-fuchsia-100" },
};

const PATTERN_NODES = [
  {
    id: "pn1", title: "交換取引と損益取引を見分ける", kind: "concept", chapter: "pat1",
    desc: "収益・費用が発生するかどうかで取引を見分けます。",
    questions: [
      { id: "pn1-1", format: "twochoice", prompt: "現金を当座預金に預け入れた。これは？", options: ["交換取引", "損益取引"], answer: "交換取引", explanation: "資産(現金)が資産(当座預金)に姿を変えただけなので交換取引です。" },
      { id: "pn1-2", format: "twochoice", prompt: "商品を売り上げ、代金を現金で受け取った。これは？", options: ["交換取引", "損益取引"], answer: "損益取引", explanation: "売上という収益が発生しているので損益取引です。" },
      { id: "pn1-3", format: "twochoice", prompt: "銀行から現金を借り入れた。これは？", options: ["交換取引", "損益取引"], answer: "交換取引", explanation: "資産(現金)の増加と負債(借入金)の増加の組み合わせで、収益・費用が発生しないため交換取引です。" },
      { id: "pn1-4", format: "twochoice", prompt: "商品を仕入れ、代金は現金で支払った。これは？", options: ["交換取引", "損益取引"], answer: "損益取引", explanation: "仕入という費用が発生しているので損益取引です。" },
      { id: "pn1-5", format: "twochoice", prompt: "買掛金を現金で支払った。これは？", options: ["交換取引", "損益取引"], answer: "交換取引", explanation: "負債(買掛金)の減少と資産(現金)の減少の組み合わせで、収益・費用は発生しないため交換取引です。" },
      { id: "pn1-6", format: "twochoice", prompt: "従業員に給料を現金で支払った。これは？", options: ["交換取引", "損益取引"], answer: "損益取引", explanation: "給料という費用が発生しているので損益取引です。" },
    ],
  },
  {
    id: "pn2", title: "交換取引の仕訳", kind: "training", chapter: "pat1",
    desc: "資産・負債の入れ替えだけで完結する仕訳です。",
    questions: [
      { id: "pn2-1", format: "journal", prompt: "現金80,000円を当座預金に預け入れた。", debitAccount: "当座預金", debitAmount: 80000, creditAccount: "現金", creditAmount: 80000, explanation: "資産(現金)が資産(当座預金)に入れ替わるだけの交換取引です。" },
      { id: "pn2-2", format: "journal", prompt: "当座預金から現金50,000円を引き出した。", debitAccount: "現金", debitAmount: 50000, creditAccount: "当座預金", creditAmount: 50000, explanation: "資産どうしの入れ替えなので交換取引です。" },
      { id: "pn2-3", format: "journal", prompt: "銀行から200,000円を借り入れ、現金で受け取った。", debitAccount: "現金", debitAmount: 200000, creditAccount: "借入金", creditAmount: 200000, explanation: "資産の増加と負債の増加の組み合わせで、収益・費用は発生しません。" },
      { id: "pn2-4", format: "journal", prompt: "買掛金30,000円を現金で支払った。", debitAccount: "買掛金", debitAmount: 30000, creditAccount: "現金", creditAmount: 30000, explanation: "負債の減少と資産の減少の組み合わせで、収益・費用は発生しません。" },
    ],
  },
  {
    id: "pn3", title: "損益取引の仕訳", kind: "training", chapter: "pat2",
    desc: "収益・費用が発生する仕訳のパターンです。",
    questions: [
      { id: "pn3-1", format: "journal", prompt: "商品80,000円を売り上げ、現金で受け取った。", debitAccount: "現金", debitAmount: 80000, creditAccount: "売上", creditAmount: 80000, explanation: "売上（収益）が発生する損益取引です。" },
      { id: "pn3-2", format: "journal", prompt: "商品50,000円を仕入れ、現金で支払った。", debitAccount: "仕入", debitAmount: 50000, creditAccount: "現金", creditAmount: 50000, explanation: "仕入（費用）が発生する損益取引です。" },
      { id: "pn3-3", format: "journal", prompt: "従業員に給料150,000円を現金で支払った。", debitAccount: "給料", debitAmount: 150000, creditAccount: "現金", creditAmount: 150000, explanation: "給料（費用）が発生する損益取引です。" },
      { id: "pn3-4", format: "journal", prompt: "受取手数料3,000円を現金で受け取った。", debitAccount: "現金", debitAmount: 3000, creditAccount: "受取手数料", creditAmount: 3000, explanation: "受取手数料（収益）が発生する損益取引です。" },
    ],
  },
  {
    id: "pn4", title: "一時的な勘定科目を見分ける", kind: "concept", chapter: "pat3",
    desc: "内容や金額が未確定なときに使う科目です。",
    questions: [
      { id: "pn4-1", format: "classify", prompt: "仮払金", answer: "資産", explanation: "内容や金額が未確定な支出は仮払金（資産）でいったん受け止めます。" },
      { id: "pn4-2", format: "classify", prompt: "仮受金", answer: "負債", explanation: "内容不明の入金は仮受金（負債）でいったん受け止めます。" },
      { id: "pn4-3", format: "classify", prompt: "前払金", answer: "資産", explanation: "商品を受け取る前に支払った内金は前払金（資産）です。" },
      { id: "pn4-4", format: "classify", prompt: "前受金", answer: "負債", explanation: "商品を渡す前に受け取った内金は前受金（負債）です。" },
      { id: "pn4-5", format: "classify", prompt: "立替金", answer: "資産", explanation: "従業員などに代わって立て替えたお金は立替金（資産）です。" },
      { id: "pn4-6", format: "classify", prompt: "預り金", answer: "負債", explanation: "従業員から一時的に預かったお金は預り金（負債）です。" },
    ],
  },
  {
    id: "pn5", title: "一時的な勘定科目の仕訳", kind: "training", chapter: "pat3",
    desc: "仮払金・仮受金などを本来の科目に振り替えます。",
    questions: [
      { id: "pn5-1", format: "journal", prompt: "出張する従業員に旅費の概算額20,000円を現金で前渡しした。", debitAccount: "仮払金", debitAmount: 20000, creditAccount: "現金", creditAmount: 20000, explanation: "内容や金額が未確定な支出はいったん仮払金で処理します。" },
      { id: "pn5-2", format: "journal", prompt: "前渡ししていた旅費の仮払金20,000円について、実際にかかった旅費が20,000円であったとの報告を受けた。", debitAccount: "旅費交通費", debitAmount: 20000, creditAccount: "仮払金", creditAmount: 20000, explanation: "内容が確定したので、仮払金から旅費交通費（費用）に振り替えます。" },
      { id: "pn5-3", format: "journal", prompt: "内容不明の入金3,000円があり仮受金として処理していたが、これは売掛金の回収であることが判明した。", debitAccount: "仮受金", debitAmount: 3000, creditAccount: "売掛金", creditAmount: 3000, explanation: "内容が判明したので、仮受金から売掛金に振り替えます。" },
      { id: "pn5-4", format: "journal", prompt: "商品を注文し、内金として10,000円を現金で支払った。", debitAccount: "前払金", debitAmount: 10000, creditAccount: "現金", creditAmount: 10000, explanation: "商品を受け取る前の内金は前払金（資産）で処理します。" },
    ],
  },
];

/* ---------------------------------------------------------
   コース0（標準コース）: 勘定科目コース
   選択式（5要素分類）のみ。「答えの種類」ではなく
   「どんな場面で使う科目か」でレッスンを構成する。
   その場面で登場しうる科目は相手科目も含めて出題するため、
   同じ科目が複数のレッスンにまたがって繰り返し登場する。
   各CHAPTERの最後には、その章の確認レッスンを置く。
   貸倒引当金・減価償却累計額は資産のマイナス項目（評価勘定）だが、
   貸借対照表では資産の部に表示されるため本コースでは資産として扱う。
--------------------------------------------------------- */

const ACCOUNTS_CHAPTERS = {
  scA: { title: "CHAPTER A", subtitle: "商品を仕入れて売る", bg: "bg-emerald-500", sub: "text-emerald-100" },
  scB: { title: "CHAPTER B", subtitle: "お金を持つ・預ける", bg: "bg-sky-500", sub: "text-sky-100" },
  scC: { title: "CHAPTER C", subtitle: "貸し借りと手形", bg: "bg-indigo-500", sub: "text-indigo-100" },
  scD: { title: "CHAPTER D", subtitle: "従業員とお金", bg: "bg-violet-500", sub: "text-violet-100" },
  scE: { title: "CHAPTER E", subtitle: "会社を運営する経費", bg: "bg-orange-500", sub: "text-orange-100" },
  scF: { title: "CHAPTER F", subtitle: "固定資産を持つ", bg: "bg-amber-600", sub: "text-amber-100" },
  scG: { title: "CHAPTER G", subtitle: "決算で整理する", bg: "bg-rose-500", sub: "text-rose-100" },
  scH: { title: "CHAPTER H", subtitle: "税金を納める", bg: "bg-red-500", sub: "text-red-100" },
  scI: { title: "CHAPTER I", subtitle: "会社の元手と利益", bg: "bg-fuchsia-500", sub: "text-fuchsia-100" },
  scMix: { title: "CHAPTER J", subtitle: "場面ミックス", bg: "bg-slate-600", sub: "text-slate-200" },
};

function classifyQ(id, prompt, answer, explanation) {
  return { id, format: "classify", prompt, answer, explanation };
}

const ACCOUNTS_NODES = [
  /* ===== CHAPTER A: 商品を仕入れて売る ===== */
  {
    id: "ac-a1", title: "商品を仕入れて売る", kind: "concept", chapter: "scA",
    desc: "三分法で商品売買を記録するときの科目です。",
    questions: [
      classifyQ("ac-a1-1", "仕入", "費用", "商品の仕入れにかかった金額は費用です。"),
      classifyQ("ac-a1-2", "売上", "収益", "商品を売った代金は収益です。"),
      classifyQ("ac-a1-3", "売上高", "収益", "売上と同じ内容を表す収益です。"),
      classifyQ("ac-a1-4", "繰越商品", "資産", "決算時点で売れ残っている商品は資産です。"),
      classifyQ("ac-a1-5", "商品", "資産", "会社が販売用に持っている商品そのものは資産です。"),
      classifyQ("ac-a1-6", "売上原価", "費用", "売り上げた商品の原価を表す費用です。"),
      classifyQ("ac-a1-7", "商品売買益", "収益", "商品を売った際の利益そのものを表す収益です。"),
      classifyQ("ac-a1-8", "発送費", "費用", "商品を売り上げた際の発送費用は費用です。"),
      classifyQ("ac-a1-9", "現金", "資産", "代金を現金で受け払いしたときに使う資産です。"),
      classifyQ("ac-a1-10", "普通預金", "資産", "代金を口座で受け払いしたときに使う資産です。"),
    ],
  },
  {
    id: "ac-a2", title: "代金は後払い・前払い", kind: "concept", chapter: "scA",
    desc: "掛け取引・内金・手形での決済で使う科目です。",
    questions: [
      classifyQ("ac-a2-1", "売掛金", "資産", "商品代金を後で受け取る権利は資産です。"),
      classifyQ("ac-a2-2", "買掛金", "負債", "商品代金を後で支払う義務は負債です。"),
      classifyQ("ac-a2-3", "クレジット売掛金", "資産", "クレジット払いの売上代金を受け取る権利は資産です。"),
      classifyQ("ac-a2-4", "前払金", "資産", "商品を受け取る前に支払った内金は、商品を受け取る権利なので資産です。"),
      classifyQ("ac-a2-5", "前受金", "負債", "商品を渡す前に受け取った内金は、商品を渡す義務なので負債です。"),
      classifyQ("ac-a2-6", "支払手数料", "費用", "クレジット決済にかかる手数料は費用です。"),
      classifyQ("ac-a2-7", "受取手形", "資産", "掛代金を手形で回収したときに使う、受け取る権利なので資産です。"),
      classifyQ("ac-a2-8", "支払手形", "負債", "掛代金を手形で支払ったときに使う、支払う義務なので負債です。"),
      classifyQ("ac-a2-9", "当座預金", "資産", "掛代金の決済に使う口座で、資産です。"),
      classifyQ("ac-a2-10", "現金", "資産", "掛代金を現金で回収・支払いしたときに使う資産です。"),
    ],
  },
  {
    id: "ac-a-check", title: "CHAPTER A チェック", kind: "checkpoint", chapter: "scA",
    desc: "商品売買の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-a-check-1", "売上原価", "費用", "売り上げた商品の原価は費用です。"),
      classifyQ("ac-a-check-2", "前受金", "負債", "商品を渡す前に受け取った内金は負債です。"),
      classifyQ("ac-a-check-3", "クレジット売掛金", "資産", "クレジット払いの売上代金を受け取る権利は資産です。"),
      classifyQ("ac-a-check-4", "商品売買益", "収益", "商品を売った際の利益を表す収益です。"),
      classifyQ("ac-a-check-5", "発送費", "費用", "商品発送にかかった費用です。"),
      classifyQ("ac-a-check-6", "買掛金", "負債", "商品代金を後で支払う義務は負債です。"),
    ],
  },

  /* ===== CHAPTER B: お金を持つ・預ける ===== */
  {
    id: "ac-b1", title: "現金と預金", kind: "concept", chapter: "scB",
    desc: "手元のお金や銀行口座にまつわる科目です。",
    questions: [
      classifyQ("ac-b1-1", "現金", "資産", "現金は資産です。"),
      classifyQ("ac-b1-2", "小口現金", "資産", "少額の支払いのために前渡しした現金は資産です。"),
      classifyQ("ac-b1-3", "当座預金", "資産", "小切手の支払いに使う当座預金は資産です。"),
      classifyQ("ac-b1-4", "普通預金", "資産", "普通預金は資産です。"),
      classifyQ("ac-b1-5", "定期預金", "資産", "定期預金は資産です。"),
      classifyQ("ac-b1-6", "当座借越", "負債", "当座預金残高を超えて引き出した分は、銀行への借金なので負債です。"),
      classifyQ("ac-b1-7", "受取利息", "収益", "預金につく利息の受け取りは収益です。"),
      classifyQ("ac-b1-8", "支払手数料", "費用", "振込手数料などの支払いは費用です。"),
    ],
  },
  {
    id: "ac-b2", title: "現金過不足と小口現金", kind: "concept", chapter: "scB",
    desc: "帳簿と実際有高のズレ、小口現金で払う経費です。",
    questions: [
      classifyQ("ac-b2-1", "雑損", "費用", "原因不明の現金不足を決算で処理する費用です。"),
      classifyQ("ac-b2-2", "雑益", "収益", "原因不明の現金過剰を決算で処理する収益です。"),
      classifyQ("ac-b2-3", "小口現金", "資産", "各部署に前渡しした少額の現金は資産です。"),
      classifyQ("ac-b2-4", "現金", "資産", "現金は資産です。"),
      classifyQ("ac-b2-5", "通信費", "費用", "小口現金から払う切手代・電話代は費用です。"),
      classifyQ("ac-b2-6", "旅費交通費", "費用", "小口現金から払う電車代などは費用です。"),
      classifyQ("ac-b2-7", "消耗品費", "費用", "小口現金から払う文房具代などは費用です。"),
      classifyQ("ac-b2-8", "水道光熱費", "費用", "電気・ガス・水道の料金は費用です。"),
      classifyQ("ac-b2-9", "雑費", "費用", "他のどの科目にも当てはまらない少額の支出は費用です。"),
    ],
  },
  {
    id: "ac-b-check", title: "CHAPTER B チェック", kind: "checkpoint", chapter: "scB",
    desc: "現金・預金の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-b-check-1", "当座借越", "負債", "当座預金残高を超えて引き出した分は負債です。"),
      classifyQ("ac-b-check-2", "小口現金", "資産", "前渡しした少額の現金は資産です。"),
      classifyQ("ac-b-check-3", "雑益", "収益", "原因不明の現金過剰を処理する収益です。"),
      classifyQ("ac-b-check-4", "雑損", "費用", "原因不明の現金不足を処理する費用です。"),
      classifyQ("ac-b-check-5", "定期預金", "資産", "定期預金は資産です。"),
      classifyQ("ac-b-check-6", "受取利息", "収益", "預金につく利息の受け取りは収益です。"),
    ],
  },

  /* ===== CHAPTER C: 貸し借りと手形 ===== */
  {
    id: "ac-c1", title: "手形と電子記録債権債務", kind: "concept", chapter: "scC",
    desc: "受け取る側と支払う側で対になる科目です。",
    questions: [
      classifyQ("ac-c1-1", "受取手形", "資産", "手形代金を受け取る権利は資産です。"),
      classifyQ("ac-c1-2", "支払手形", "負債", "手形代金を後で支払う義務は負債です。"),
      classifyQ("ac-c1-3", "電子記録債権", "資産", "電子化された「受け取る権利」は資産です。"),
      classifyQ("ac-c1-4", "電子記録債務", "負債", "電子化された「支払う義務」は負債です。"),
      classifyQ("ac-c1-5", "手形貸付金", "資産", "手形を受け取って貸し付けたお金は、返してもらう権利なので資産です。"),
      classifyQ("ac-c1-6", "手形借入金", "負債", "手形を振り出して借り入れたお金は、返す義務なので負債です。"),
      classifyQ("ac-c1-7", "売掛金", "資産", "手形に置き換わる前の、代金を受け取る権利は資産です。"),
      classifyQ("ac-c1-8", "買掛金", "負債", "手形に置き換わる前の、代金を支払う義務は負債です。"),
      classifyQ("ac-c1-9", "当座預金", "資産", "手形が決済される口座で、資産です。"),
    ],
  },
  {
    id: "ac-c2", title: "お金の貸し借り・商品以外の売買", kind: "concept", chapter: "scC",
    desc: "貸付・借入と、商品以外の代金のやりとりです。",
    questions: [
      classifyQ("ac-c2-1", "貸付金", "資産", "他社などに貸したお金は、返してもらう権利なので資産です。"),
      classifyQ("ac-c2-2", "借入金", "負債", "銀行などから借りたお金は、返す義務なので負債です。"),
      classifyQ("ac-c2-3", "受取利息", "収益", "貸付金などにかかる利息の受け取りは収益です。"),
      classifyQ("ac-c2-4", "支払利息", "費用", "借入金にかかる利息の支払いは費用です。"),
      classifyQ("ac-c2-5", "未収入金", "資産", "商品以外（備品の売却など）の代金を後で受け取る権利は資産です。"),
      classifyQ("ac-c2-6", "未収金", "資産", "未収入金と同じく、代金を後で受け取る権利は資産です。"),
      classifyQ("ac-c2-7", "未払金", "負債", "商品以外（備品の購入など）の代金を後で支払う義務は負債です。"),
      classifyQ("ac-c2-8", "備品", "資産", "商品以外の売買の対象になる備品は資産です。"),
      classifyQ("ac-c2-9", "普通預金", "資産", "貸付・借入の入出金に使う口座で、資産です。"),
    ],
  },
  {
    id: "ac-c-check", title: "CHAPTER C チェック", kind: "checkpoint", chapter: "scC",
    desc: "貸し借りと手形の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-c-check-1", "電子記録債務", "負債", "電子化された支払う義務は負債です。"),
      classifyQ("ac-c-check-2", "手形貸付金", "資産", "手形を受け取って貸し付けたお金は資産です。"),
      classifyQ("ac-c-check-3", "手形借入金", "負債", "手形を振り出して借り入れたお金は負債です。"),
      classifyQ("ac-c-check-4", "未収入金", "資産", "商品以外の代金を後で受け取る権利は資産です。"),
      classifyQ("ac-c-check-5", "支払利息", "費用", "借入金にかかる利息の支払いは費用です。"),
      classifyQ("ac-c-check-6", "受取手形", "資産", "手形代金を受け取る権利は資産です。"),
    ],
  },

  /* ===== CHAPTER D: 従業員とお金 ===== */
  {
    id: "ac-d1", title: "給料を支払う", kind: "concept", chapter: "scD",
    desc: "給料から天引きして預かるお金と、会社負担の費用です。",
    questions: [
      classifyQ("ac-d1-1", "給料", "費用", "従業員への給料は費用です。"),
      classifyQ("ac-d1-2", "法定福利費", "費用", "会社が負担する社会保険料は費用です。"),
      classifyQ("ac-d1-3", "預り金", "負債", "従業員などから一時的に預かったお金は、後で納める義務なので負債です。"),
      classifyQ("ac-d1-4", "所得税預り金", "負債", "給料から天引きして預かった所得税は負債です。"),
      classifyQ("ac-d1-5", "従業員預り金", "負債", "従業員から一時的に預かったお金は負債です。"),
      classifyQ("ac-d1-6", "社会保険料預り金", "負債", "給料から天引きして預かった社会保険料は負債です。"),
      classifyQ("ac-d1-7", "立替金", "資産", "取引先などに代わって立て替えたお金は、返してもらう権利なので資産です。"),
      classifyQ("ac-d1-8", "従業員立替金", "資産", "従業員に代わって立て替えたお金は資産です。"),
      classifyQ("ac-d1-9", "普通預金", "資産", "給料の振込に使う口座で、資産です。"),
      classifyQ("ac-d1-10", "現金", "資産", "給料を現金で支払うときに使う資産です。"),
    ],
  },
  {
    id: "ac-d2", title: "出張と内容未確定のお金", kind: "concept", chapter: "scD",
    desc: "金額や内容が決まる前に、いったん受け止める科目です。",
    questions: [
      classifyQ("ac-d2-1", "仮払金", "資産", "内容や金額が未確定な支出は、いったん資産として処理します。"),
      classifyQ("ac-d2-2", "仮受金", "負債", "内容不明の入金は、いったん負債として処理します。"),
      classifyQ("ac-d2-3", "旅費交通費", "費用", "出張や移動にかかった費用です。"),
      classifyQ("ac-d2-4", "立替金", "資産", "立て替えたお金は返してもらう権利なので資産です。"),
      classifyQ("ac-d2-5", "預り金", "負債", "一時的に預かったお金は負債です。"),
      classifyQ("ac-d2-6", "現金", "資産", "概算額を前渡しするときに使う資産です。"),
      classifyQ("ac-d2-7", "売掛金", "資産", "仮受金の内容が売掛金の回収と判明したときに振り替える資産です。"),
      classifyQ("ac-d2-8", "未収入金", "資産", "仮受金の内容が判明したときの振替先になる資産です。"),
      classifyQ("ac-d2-9", "通信費", "費用", "出張中の通信費用も費用として処理します。"),
    ],
  },
  {
    id: "ac-d-check", title: "CHAPTER D チェック", kind: "checkpoint", chapter: "scD",
    desc: "従業員とお金の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-d-check-1", "社会保険料預り金", "負債", "天引きして預かった社会保険料は負債です。"),
      classifyQ("ac-d-check-2", "法定福利費", "費用", "会社が負担する社会保険料は費用です。"),
      classifyQ("ac-d-check-3", "従業員立替金", "資産", "従業員に代わって立て替えたお金は資産です。"),
      classifyQ("ac-d-check-4", "仮受金", "負債", "内容不明の入金はいったん負債として処理します。"),
      classifyQ("ac-d-check-5", "仮払金", "資産", "内容未確定の支出はいったん資産として処理します。"),
      classifyQ("ac-d-check-6", "旅費交通費", "費用", "出張や移動にかかった費用です。"),
    ],
  },

  /* ===== CHAPTER E: 会社を運営する経費 ===== */
  {
    id: "ac-e1", title: "オフィスの経費を払う", kind: "concept", chapter: "scE",
    desc: "日々の運営でかかる経費と、その未払い分です。",
    questions: [
      classifyQ("ac-e1-1", "水道光熱費", "費用", "電気・ガス・水道の料金は費用です。"),
      classifyQ("ac-e1-2", "通信費", "費用", "電話代・切手代などは費用です。"),
      classifyQ("ac-e1-3", "消耗品費", "費用", "文房具などの消耗品にかかった費用です。"),
      classifyQ("ac-e1-4", "雑費", "費用", "他のどの科目にも当てはまらない少額の支出は費用です。"),
      classifyQ("ac-e1-5", "広告宣伝費", "費用", "広告にかかった費用です。"),
      classifyQ("ac-e1-6", "租税公課", "費用", "印紙税や固定資産税などの税金は費用です。"),
      classifyQ("ac-e1-7", "貯蔵品", "資産", "期末に使い残した切手・収入印紙は、まだ価値が残っているので資産です。"),
      classifyQ("ac-e1-8", "未払金", "負債", "経費の代金を後で支払う義務は負債です。"),
      classifyQ("ac-e1-9", "現金", "資産", "経費を現金で支払うときに使う資産です。"),
      classifyQ("ac-e1-10", "普通預金", "資産", "経費が口座から引き落とされるときに使う資産です。"),
    ],
  },
  {
    id: "ac-e2", title: "土地・建物を借りる／貸す", kind: "concept", chapter: "scE",
    desc: "借りる側と貸す側で逆になる科目です。",
    questions: [
      classifyQ("ac-e2-1", "支払家賃", "費用", "建物を借りたときの家賃は費用です。"),
      classifyQ("ac-e2-2", "支払地代", "費用", "土地を借りたときの地代は費用です。"),
      classifyQ("ac-e2-3", "受取家賃", "収益", "建物を貸したときの家賃収入は収益です。"),
      classifyQ("ac-e2-4", "受取地代", "収益", "土地を貸したときの地代収入は収益です。"),
      classifyQ("ac-e2-5", "差入保証金", "資産", "店舗を借りる際の敷金は、退去時に返ってくるので資産です。"),
      classifyQ("ac-e2-6", "修繕費", "費用", "建物や設備の修繕にかかった費用です。"),
      classifyQ("ac-e2-7", "前払費用", "資産", "翌期分の家賃を前払いした分は資産です。"),
      classifyQ("ac-e2-8", "未払費用", "負債", "当期分でまだ払っていない家賃は負債です。"),
      classifyQ("ac-e2-9", "建物", "資産", "会社が所有する建物は資産です。"),
      classifyQ("ac-e2-10", "土地", "資産", "会社が所有する土地は資産です。"),
    ],
  },
  {
    id: "ac-e3", title: "サービスのやりとり", kind: "concept", chapter: "scE",
    desc: "手数料・保険料など、受け取る側と支払う側の科目です。",
    questions: [
      classifyQ("ac-e3-1", "支払手数料", "費用", "振込手数料などの支払いは費用です。"),
      classifyQ("ac-e3-2", "受取手数料", "収益", "手数料の受け取りは収益です。"),
      classifyQ("ac-e3-3", "支払保険料", "費用", "保険料の支払いは費用です。"),
      classifyQ("ac-e3-4", "受取商品券", "資産", "受け取った他社発行の商品券は、後で換金できるので資産です。"),
      classifyQ("ac-e3-5", "支払利息", "費用", "利息の支払いは費用です。"),
      classifyQ("ac-e3-6", "受取利息", "収益", "利息の受け取りは収益です。"),
      classifyQ("ac-e3-7", "売掛金", "資産", "サービス提供の対価を後で受け取る権利は資産です。"),
      classifyQ("ac-e3-8", "現金", "資産", "商品券を換金したときなどに受け取る資産です。"),
    ],
  },
  {
    id: "ac-e-check", title: "CHAPTER E チェック", kind: "checkpoint", chapter: "scE",
    desc: "経費の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-e-check-1", "貯蔵品", "資産", "使い残した切手・収入印紙は資産です。"),
      classifyQ("ac-e-check-2", "差入保証金", "資産", "敷金は退去時に返ってくるので資産です。"),
      classifyQ("ac-e-check-3", "受取地代", "収益", "土地を貸したときの地代収入は収益です。"),
      classifyQ("ac-e-check-4", "租税公課", "費用", "印紙税や固定資産税などの税金は費用です。"),
      classifyQ("ac-e-check-5", "未払金", "負債", "経費の代金を後で支払う義務は負債です。"),
      classifyQ("ac-e-check-6", "受取商品券", "資産", "受け取った商品券は後で換金できるので資産です。"),
    ],
  },

  /* ===== CHAPTER F: 固定資産を持つ ===== */
  {
    id: "ac-f1", title: "固定資産を買う・売る", kind: "concept", chapter: "scF",
    desc: "長く使う資産の購入と売却で使う科目です。",
    questions: [
      classifyQ("ac-f1-1", "土地", "資産", "会社が所有する土地は資産です。"),
      classifyQ("ac-f1-2", "建物", "資産", "会社が所有する建物は資産です。"),
      classifyQ("ac-f1-3", "備品", "資産", "パソコンや机などの備品は資産です。"),
      classifyQ("ac-f1-4", "車両運搬具", "資産", "営業車などの車両は資産です。"),
      classifyQ("ac-f1-5", "未払金", "負債", "固定資産の代金を後で支払う義務は負債です。"),
      classifyQ("ac-f1-6", "未収入金", "資産", "固定資産を売った代金を後で受け取る権利は資産です。"),
      classifyQ("ac-f1-7", "修繕費", "費用", "固定資産を元の状態に戻すための支出は費用です。"),
      classifyQ("ac-f1-8", "固定資産売却益", "収益", "帳簿価額より高く売れたときの利益は収益です。"),
      classifyQ("ac-f1-9", "固定資産売却損", "費用", "帳簿価額より安く売れたときの損失は費用です。"),
      classifyQ("ac-f1-10", "当座預金", "資産", "固定資産の代金決済に使う口座で、資産です。"),
    ],
  },
  {
    id: "ac-f2", title: "減価償却をする", kind: "concept", chapter: "scF",
    desc: "固定資産の価値の減少を記録する科目です。",
    questions: [
      classifyQ("ac-f2-1", "減価償却費", "費用", "その年の価値の減少分を計上する費用です。"),
      classifyQ("ac-f2-2", "減価償却累計額", "資産", "価値の減少額を積み上げた評価勘定で、貸借対照表では資産からマイナスする形で資産の部に表示します。"),
      classifyQ("ac-f2-3", "建物", "資産", "減価償却の対象になる建物は資産です。"),
      classifyQ("ac-f2-4", "備品", "資産", "減価償却の対象になる備品は資産です。"),
      classifyQ("ac-f2-5", "車両運搬具", "資産", "減価償却の対象になる車両は資産です。"),
      classifyQ("ac-f2-6", "土地", "資産", "土地は資産ですが、価値が減らないため減価償却しません。"),
      classifyQ("ac-f2-7", "固定資産売却損", "費用", "固定資産を安く売ったときの損失は費用です。"),
      classifyQ("ac-f2-8", "固定資産売却益", "収益", "固定資産を高く売ったときの利益は収益です。"),
      classifyQ("ac-f2-9", "未収入金", "資産", "売却代金を後で受け取る権利は資産です。"),
    ],
  },
  {
    id: "ac-f-check", title: "CHAPTER F チェック", kind: "checkpoint", chapter: "scF",
    desc: "固定資産の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-f-check-1", "減価償却累計額", "資産", "価値の減少額を積み上げた評価勘定で、貸借対照表では資産の部に表示します。"),
      classifyQ("ac-f-check-2", "減価償却費", "費用", "その年の価値の減少分を計上する費用です。"),
      classifyQ("ac-f-check-3", "車両運搬具", "資産", "営業車などの車両は資産です。"),
      classifyQ("ac-f-check-4", "固定資産売却益", "収益", "帳簿価額より高く売れたときの利益は収益です。"),
      classifyQ("ac-f-check-5", "固定資産売却損", "費用", "帳簿価額より安く売れたときの損失は費用です。"),
      classifyQ("ac-f-check-6", "未払金", "負債", "固定資産の代金を後で支払う義務は負債です。"),
    ],
  },

  /* ===== CHAPTER G: 決算で整理する ===== */
  {
    id: "ac-g1", title: "貸倒れに備える", kind: "concept", chapter: "scG",
    desc: "売掛金などが回収できなくなる場合への備えです。",
    questions: [
      classifyQ("ac-g1-1", "貸倒引当金", "資産", "将来の貸倒れに備える評価勘定で、貸借対照表では売掛金からマイナスする形で資産の部に表示します。"),
      classifyQ("ac-g1-2", "貸倒引当金繰入", "費用", "貸倒引当金を積み増したときの費用です。"),
      classifyQ("ac-g1-3", "貸倒損失", "費用", "売掛金などが実際に回収できなくなったときの費用です。"),
      classifyQ("ac-g1-4", "貸倒引当金戻入", "収益", "見積りより貸倒れが少なく、引当金を戻したときの収益です。"),
      classifyQ("ac-g1-5", "償却債権取立益", "収益", "過去に貸倒れ処理した債権を回収できたときの収益です。"),
      classifyQ("ac-g1-6", "売掛金", "資産", "貸倒れの対象になる売掛金は資産です。"),
      classifyQ("ac-g1-7", "受取手形", "資産", "貸倒れの対象になる受取手形は資産です。"),
      classifyQ("ac-g1-8", "電子記録債権", "資産", "貸倒れの対象になる電子記録債権は資産です。"),
      classifyQ("ac-g1-9", "現金", "資産", "償却済み債権を回収したときに受け取る資産です。"),
    ],
  },
  {
    id: "ac-g2", title: "費用・収益の前払いと未払い", kind: "concept", chapter: "scG",
    desc: "期をまたぐ費用・収益を調整する経過勘定です。",
    questions: [
      classifyQ("ac-g2-1", "前払費用", "資産", "まだ提供を受けていないサービスへの前払い分は、サービスを受ける権利なので資産です。"),
      classifyQ("ac-g2-2", "未収収益", "資産", "発生済みだがまだ受け取っていない収益は、受け取る権利なので資産です。"),
      classifyQ("ac-g2-3", "前受収益", "負債", "まだ提供していないサービスへの前受け分は、提供する義務なので負債です。"),
      classifyQ("ac-g2-4", "未払費用", "負債", "発生済みだがまだ支払っていない費用は、支払う義務なので負債です。"),
      classifyQ("ac-g2-5", "支払家賃", "費用", "前払・未払の調整対象になる家賃の支払いは費用です。"),
      classifyQ("ac-g2-6", "受取家賃", "収益", "前受・未収の調整対象になる家賃の受け取りは収益です。"),
      classifyQ("ac-g2-7", "支払保険料", "費用", "前払の調整対象になりやすい保険料の支払いは費用です。"),
      classifyQ("ac-g2-8", "支払利息", "費用", "未払の調整対象になりやすい利息の支払いは費用です。"),
      classifyQ("ac-g2-9", "受取地代", "収益", "前受・未収の調整対象になる地代の受け取りは収益です。"),
    ],
  },
  {
    id: "ac-g3", title: "決算で振り替える", kind: "concept", chapter: "scG",
    desc: "売上原価の算定や現金過不足の整理で使う科目です。",
    questions: [
      classifyQ("ac-g3-1", "繰越商品", "資産", "期末に売れ残った商品は資産です。"),
      classifyQ("ac-g3-2", "仕入", "費用", "売上原価を算定するときに振替の相手になる費用です。"),
      classifyQ("ac-g3-3", "売上原価", "費用", "売り上げた商品の原価は費用です。"),
      classifyQ("ac-g3-4", "貯蔵品", "資産", "使い残した切手・収入印紙は資産です。"),
      classifyQ("ac-g3-5", "通信費", "費用", "貯蔵品へ振り替える前の切手代は費用です。"),
      classifyQ("ac-g3-6", "租税公課", "費用", "貯蔵品へ振り替える前の収入印紙代は費用です。"),
      classifyQ("ac-g3-7", "雑損", "費用", "原因不明の現金不足を処理する費用です。"),
      classifyQ("ac-g3-8", "雑益", "収益", "原因不明の現金過剰を処理する収益です。"),
      classifyQ("ac-g3-9", "当座借越", "負債", "決算で当座預金のマイナス残高を振り替える先で、負債です。"),
      classifyQ("ac-g3-10", "減価償却費", "費用", "固定資産の価値の減少分を計上する費用です。"),
    ],
  },
  {
    id: "ac-g-check", title: "CHAPTER G チェック", kind: "checkpoint", chapter: "scG",
    desc: "決算整理の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-g-check-1", "貸倒引当金", "資産", "貸倒れに備える評価勘定で、貸借対照表では資産の部に表示します。"),
      classifyQ("ac-g-check-2", "貸倒引当金繰入", "費用", "貸倒引当金を積み増したときの費用です。"),
      classifyQ("ac-g-check-3", "前受収益", "負債", "まだ提供していないサービスへの前受け分は負債です。"),
      classifyQ("ac-g-check-4", "未収収益", "資産", "発生済みでまだ受け取っていない収益は資産です。"),
      classifyQ("ac-g-check-5", "償却債権取立益", "収益", "過去に貸倒れ処理した債権を回収できたときの収益です。"),
      classifyQ("ac-g-check-6", "貯蔵品", "資産", "使い残した切手・収入印紙は資産です。"),
    ],
  },

  /* ===== CHAPTER H: 税金を納める ===== */
  {
    id: "ac-h1", title: "消費税を処理する", kind: "concept", chapter: "scH",
    desc: "預かった消費税と支払った消費税を相殺します。",
    questions: [
      classifyQ("ac-h1-1", "仮払消費税", "資産", "仕入時に支払った消費税は、後で差し引ける権利なので資産です。"),
      classifyQ("ac-h1-2", "仮受消費税", "負債", "販売時に預かった消費税は、後で納める義務なので負債です。"),
      classifyQ("ac-h1-3", "未払消費税", "負債", "決算で確定した、まだ納めていない消費税は負債です。"),
      classifyQ("ac-h1-4", "租税公課", "費用", "印紙税や固定資産税などの税金は費用です。"),
      classifyQ("ac-h1-5", "仕入", "費用", "消費税を支払う場面の相手科目になる費用です。"),
      classifyQ("ac-h1-6", "売上", "収益", "消費税を預かる場面の相手科目になる収益です。"),
      classifyQ("ac-h1-7", "現金", "資産", "消費税を納付するときに使う資産です。"),
      classifyQ("ac-h1-8", "普通預金", "資産", "消費税が口座から引き落とされるときに使う資産です。"),
    ],
  },
  {
    id: "ac-h2", title: "法人税を納める", kind: "concept", chapter: "scH",
    desc: "会社の利益にかかる税金の処理です。",
    questions: [
      classifyQ("ac-h2-1", "仮払法人税等", "資産", "中間申告で前払いした法人税は、後で精算される権利なので資産です。"),
      classifyQ("ac-h2-2", "未払法人税等", "負債", "決算で確定した、まだ納めていない法人税等は負債です。"),
      classifyQ("ac-h2-3", "法人税、住民税及び事業税", "費用", "会社の利益にかかる税金の費用です。"),
      classifyQ("ac-h2-4", "法人税等", "費用", "法人税、住民税及び事業税をまとめた呼び方で、同じく費用です。"),
      classifyQ("ac-h2-5", "租税公課", "費用", "印紙税など、利益にかかる税金以外の税金は費用です。"),
      classifyQ("ac-h2-6", "貯蔵品", "資産", "使い残した収入印紙は資産です。"),
      classifyQ("ac-h2-7", "当座預金", "資産", "法人税を納付する口座で、資産です。"),
      classifyQ("ac-h2-8", "現金", "資産", "法人税を現金で納付するときに使う資産です。"),
    ],
  },
  {
    id: "ac-h-check", title: "CHAPTER H チェック", kind: "checkpoint", chapter: "scH",
    desc: "税金の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-h-check-1", "仮払消費税", "資産", "支払った消費税は後で差し引けるので資産です。"),
      classifyQ("ac-h-check-2", "仮受消費税", "負債", "預かった消費税は後で納めるので負債です。"),
      classifyQ("ac-h-check-3", "未払法人税等", "負債", "まだ納めていない法人税等は負債です。"),
      classifyQ("ac-h-check-4", "仮払法人税等", "資産", "中間申告で前払いした法人税は資産です。"),
      classifyQ("ac-h-check-5", "法人税等", "費用", "会社の利益にかかる税金の費用です。"),
      classifyQ("ac-h-check-6", "租税公課", "費用", "印紙税や固定資産税などの税金は費用です。"),
    ],
  },

  /* ===== CHAPTER I: 会社の元手と利益 ===== */
  {
    id: "ac-i1", title: "株式の発行と配当", kind: "concept", chapter: "scI",
    desc: "会社の元手と、積み上げた利益にまつわる科目です。",
    questions: [
      classifyQ("ac-i1-1", "資本金", "純資産", "株主が出資した元手は純資産です。"),
      classifyQ("ac-i1-2", "資本準備金", "純資産", "出資額のうち資本金としなかった分は純資産です。"),
      classifyQ("ac-i1-3", "繰越利益剰余金", "純資産", "会社が積み上げてきた利益は純資産です。"),
      classifyQ("ac-i1-4", "未払配当金", "負債", "配当が決定したがまだ支払っていない分は、支払う義務なので負債です。"),
      classifyQ("ac-i1-5", "当座預金", "資産", "出資金の払込みや配当の支払いに使う口座で、資産です。"),
      classifyQ("ac-i1-6", "普通預金", "資産", "配当金の振込に使う口座で、資産です。"),
      classifyQ("ac-i1-7", "現金", "資産", "配当金を現金で支払うときに使う資産です。"),
    ],
  },
  {
    id: "ac-i-check", title: "CHAPTER I チェック", kind: "checkpoint", chapter: "scI",
    desc: "会社の元手と利益の場面の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-i-check-1", "資本準備金", "純資産", "出資額のうち資本金としなかった分は純資産です。"),
      classifyQ("ac-i-check-2", "繰越利益剰余金", "純資産", "会社が積み上げてきた利益は純資産です。"),
      classifyQ("ac-i-check-3", "未払配当金", "負債", "まだ支払っていない配当金は負債です。"),
      classifyQ("ac-i-check-4", "資本金", "純資産", "株主が出資した元手は純資産です。"),
      classifyQ("ac-i-check-5", "当座預金", "資産", "出資金の払込みに使う口座で、資産です。"),
    ],
  },

  /* ===== CHAPTER J: 場面ミックス ===== */
  {
    id: "ac-mix1", title: "場面ミックス①", kind: "training", chapter: "scMix",
    desc: "いろいろな場面の科目をまぜて分類します。",
    questions: [
      classifyQ("ac-mix1-1", "電子記録債権", "資産", "電子化された受け取る権利は資産です。"),
      classifyQ("ac-mix1-2", "所得税預り金", "負債", "天引きして預かった所得税は負債です。"),
      classifyQ("ac-mix1-3", "資本金", "純資産", "元手として出資したお金は純資産です。"),
      classifyQ("ac-mix1-4", "貸倒引当金繰入", "費用", "貸倒引当金を積み増したときの費用です。"),
      classifyQ("ac-mix1-5", "受取地代", "収益", "土地を貸したときの地代収入は収益です。"),
      classifyQ("ac-mix1-6", "貯蔵品", "資産", "使い残した切手・収入印紙は資産です。"),
      classifyQ("ac-mix1-7", "当座借越", "負債", "当座預金残高を超えて引き出した分は負債です。"),
      classifyQ("ac-mix1-8", "発送費", "費用", "商品を売り上げた際の発送費用は費用です。"),
      classifyQ("ac-mix1-9", "商品売買益", "収益", "商品を売った際の利益を表す収益です。"),
      classifyQ("ac-mix1-10", "差入保証金", "資産", "敷金は退去時に返ってくるので資産です。"),
    ],
  },
  {
    id: "ac-mix2", title: "場面ミックス②", kind: "training", chapter: "scMix",
    desc: "まぎらわしい科目を中心にまぜて分類します。",
    questions: [
      classifyQ("ac-mix2-1", "前払費用", "資産", "サービスを受ける前の前払い分は資産です。"),
      classifyQ("ac-mix2-2", "前受収益", "負債", "サービスを提供する前の前受け分は負債です。"),
      classifyQ("ac-mix2-3", "未収収益", "資産", "発生済みでまだ受け取っていない収益は資産です。"),
      classifyQ("ac-mix2-4", "未払費用", "負債", "発生済みでまだ支払っていない費用は負債です。"),
      classifyQ("ac-mix2-5", "仮払消費税", "資産", "支払った消費税は後で差し引けるので資産です。"),
      classifyQ("ac-mix2-6", "仮受消費税", "負債", "預かった消費税は後で納めるので負債です。"),
      classifyQ("ac-mix2-7", "繰越利益剰余金", "純資産", "積み上げた利益は純資産です。"),
      classifyQ("ac-mix2-8", "償却債権取立益", "収益", "過去に貸倒れ処理した債権を回収できたときの収益です。"),
      classifyQ("ac-mix2-9", "手形借入金", "負債", "手形を振り出して借り入れたお金は負債です。"),
      classifyQ("ac-mix2-10", "手形貸付金", "資産", "手形を受け取って貸し付けたお金は資産です。"),
    ],
  },
  {
    id: "ac-check", title: "勘定科目コース 総合チェック", kind: "checkpoint", chapter: "scMix",
    desc: "コース全体の確認テストです（合格ライン70%）。",
    questions: [
      classifyQ("ac-check-1", "減価償却累計額", "資産", "価値の減少額を積み上げた評価勘定で、貸借対照表では資産の部に表示します。"),
      classifyQ("ac-check-2", "社会保険料預り金", "負債", "天引きして預かった社会保険料は負債です。"),
      classifyQ("ac-check-3", "資本準備金", "純資産", "出資額のうち資本金としなかった分は純資産です。"),
      classifyQ("ac-check-4", "法定福利費", "費用", "会社が負担する社会保険料は費用です。"),
      classifyQ("ac-check-5", "固定資産売却益", "収益", "帳簿価額より高く売れたときの利益は収益です。"),
      classifyQ("ac-check-6", "受取商品券", "資産", "受け取った商品券は後で換金できるので資産です。"),
      classifyQ("ac-check-7", "未払配当金", "負債", "まだ支払っていない配当金は負債です。"),
      classifyQ("ac-check-8", "売上原価", "費用", "売り上げた商品の原価は費用です。"),
    ],
  },
];

/* ---------------------------------------------------------
   コース一覧
--------------------------------------------------------- */

const COURSES = [
  {
    id: "accounts",
    title: "勘定科目コース",
    subtitle: "選択式で勘定科目を一気に覚える",
    chapters: ACCOUNTS_CHAPTERS,
    nodes: ACCOUNTS_NODES,
    stubNote: "手形・固定資産台帳など、関連する勘定科目の追加分・準備中",
  },
  {
    id: "journalBlank",
    title: "仕訳穴埋めコース",
    subtitle: "空欄に勘定科目を入れて仕訳を作る",
    chapters: JOURNAL_BLANK_CHAPTERS,
    nodes: JOURNAL_BLANK_NODES,
    stubNote: "税金・株式会社の仕訳・準備中",
  },
  {
    id: "tac",
    title: "TAC出版準拠コース",
    subtitle: "教科書の章立てで学ぶ",
    chapters: TAC_CHAPTERS,
    nodes: TAC_NODES,
    stubNote: "CHAPTER 03〜13・準備中（手形/固定資産/その他取引/帳簿/試算表/伝票/決算 など）",
  },
  {
    id: "pattern",
    title: "思考パターン別コース",
    subtitle: "仕訳の考え方のパターンで学ぶ",
    chapters: PATTERN_CHAPTERS,
    nodes: PATTERN_NODES,
    stubNote: "見越し・繰延べパターン／資産の振替パターンなど・準備中",
  },
];

/* ---------------------------------------------------------
   小さな見た目パーツ
--------------------------------------------------------- */

function StatButton({ icon, value, onClick, bg }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${bg}`}>
      {icon}
      <span className="font-extrabold text-sm text-gray-700">{value}</span>
    </button>
  );
}

function DetailHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <button onClick={onClose} className="text-gray-400">
        <X className="w-6 h-6" />
      </button>
      <p className="font-extrabold text-gray-800">{title}</p>
      <div className="w-6" />
    </div>
  );
}

function Header({ courseTitle, streak, solvedCount, hearts, onOpenCourses, onOpenStreak, onOpenProgress, onOpenReview }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
      <button onClick={onOpenCourses} className="flex items-center gap-1 shrink-0 min-w-0">
        <span className="font-extrabold text-green-600 text-base tracking-tight truncate max-w-32">{courseTitle}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <StatButton icon={<Flame className="w-4 h-4 text-orange-500 fill-orange-500" />} value={streak} bg="bg-orange-50" onClick={onOpenStreak} />
        <StatButton icon={<Gem className="w-4 h-4 text-sky-500" />} value={solvedCount} bg="bg-sky-50" onClick={onOpenProgress} />
        <StatButton
          icon={<Heart className={`w-4 h-4 text-red-500 ${hearts > 0 ? "fill-red-500" : ""}`} />}
          value={hearts}
          bg="bg-red-50"
          onClick={onOpenReview}
        />
      </div>
    </div>
  );
}

function SectionBanner({ info, stats }) {
  const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <div className={`${info.bg} text-white rounded-2xl p-4 mb-6 shadow w-full`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${info.sub}`}>{info.title}</p>
      <p className="text-xl font-extrabold">{info.subtitle}</p>
      {stats && (
        <div className="mt-3">
          <div className="h-2 bg-black/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/90 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className={`text-xs font-bold mt-1 ${info.sub}`}>
            {stats.done}/{stats.total} レッスン完了
          </p>
        </div>
      )}
    </div>
  );
}

function UnitDivider({ label }) {
  return (
    <div className="flex items-center gap-3 w-full my-3">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

function NodeIcon({ kind, state }) {
  const cls = "w-7 h-7";
  if (state === "locked") return <Lock className={cls} />;
  if (state === "completed") return <Star className={`${cls} fill-white`} />;
  if (kind === "training") return <Dumbbell className={cls} />;
  if (kind === "checkpoint") return <Trophy className={cls} />;
  return <BookOpen className={cls} />;
}

const OFFSETS = [0, 64, 96, 64, 0, -64, -96, -64];

function PathNode({ node, index, state, onTap }) {
  const offset = OFFSETS[index % OFFSETS.length];
  const styleByState = {
    locked: "bg-gray-300 border-gray-400 text-gray-400",
    current: "bg-green-500 border-green-600 text-white",
    completed: "bg-amber-400 border-amber-500 text-white",
  }[state];

  return (
    <div className="relative flex flex-col items-center" style={{ transform: `translateX(${offset}px)`, marginBottom: "28px" }}>
      {state === "current" && (
        <div className="absolute -top-9 bg-white border border-gray-200 shadow px-3 py-1 rounded-xl text-xs font-extrabold text-green-600 whitespace-nowrap animate-bounce">
          スタート
        </div>
      )}
      <button
        onClick={() => onTap(index)}
        className={`w-16 h-16 rounded-full border-b-4 flex items-center justify-center shadow-md
          active:translate-y-0.5 active:border-b-2 transition-transform
          ${styleByState}
          ${state === "current" ? "ring-4 ring-green-200" : ""}
        `}
      >
        <NodeIcon kind={node.kind} state={state} />
      </button>
      <span className="mt-2 text-xs font-bold text-gray-500 w-24 text-center leading-tight">{node.title}</span>
    </div>
  );
}

function NodeSheet({ node, state, onStart, onClose }) {
  if (!node) return null;
  const kindLabel = { concept: "たんご", training: "トレーニング", checkpoint: "チェックポイント" }[node.kind];
  const kindColor = { concept: "text-green-600 bg-green-50", training: "text-sky-600 bg-sky-50", checkpoint: "text-amber-600 bg-amber-50" }[node.kind];

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-t-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-extrabold px-2 py-1 rounded-full ${kindColor}`}>{kindLabel}</span>
          <button onClick={onClose} className="text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-lg font-extrabold text-gray-800">{node.title}</p>
        <p className="text-sm text-gray-500 mt-1 mb-5">{node.desc}</p>

        {state === "locked" && (
          <p className="text-xs text-gray-400 font-bold mb-3">
            まだ解放されていません。先に進みたい場合はスキップできます。
          </p>
        )}

        {state === "locked" ? (
          <button
            onClick={onStart}
            className="w-full font-extrabold py-3 rounded-2xl border border-gray-300 text-gray-500 bg-white active:bg-gray-50 transition-colors"
          >
            スキップしてレッスンを始める
          </button>
        ) : (
          <button
            onClick={onStart}
            className="w-full font-extrabold py-3 rounded-2xl border-b-4 bg-green-500 border-green-600 text-white active:translate-y-0.5 active:border-b-2 transition-transform"
          >
            {state === "completed" ? "れんしゅうする" : "レッスンをはじめる"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   問題フォーマット
--------------------------------------------------------- */

function ClassifyQuestion({ q, answer, setAnswer }) {
  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">どの要素？</p>
      <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-center">
        <p className="text-2xl font-extrabold text-gray-800">{q.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ELEMENTS.map((el) => (
          <button
            key={el}
            onClick={() => setAnswer(el)}
            className={`py-3 rounded-2xl font-extrabold border-b-4 transition-transform active:translate-y-0.5 active:border-b-2
              ${answer === el ? "bg-sky-500 border-sky-600 text-white" : "bg-white border-gray-200 text-gray-700"}
            `}
          >
            {el}
          </button>
        ))}
      </div>
    </div>
  );
}

function TwoChoiceQuestion({ q, answer, setAnswer }) {
  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">正しいのはどっち？</p>
      <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-center">
        <p className="text-lg font-extrabold text-gray-800">{q.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt) => (
          <button
            key={opt}
            onClick={() => setAnswer(opt)}
            className={`py-4 rounded-2xl font-extrabold border-b-4 transition-transform active:translate-y-0.5 active:border-b-2
              ${answer === opt ? "bg-sky-500 border-sky-600 text-white" : "bg-white border-gray-200 text-gray-700"}
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function FillBlankQuestion({ q, answer, setAnswer }) {
  const [before, after] = q.prompt.split("［　］");
  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">空欄を埋めよう</p>
      <div className="bg-gray-50 rounded-2xl p-6 mb-6">
        <p className="text-base font-bold text-gray-800 leading-relaxed">
          {before}
          <span className="inline-block min-w-16 border-b-2 border-sky-400 text-sky-600 text-center mx-1">{answer || "　"}</span>
          {after}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt) => (
          <button
            key={opt}
            onClick={() => setAnswer(opt)}
            className={`py-3 rounded-2xl font-extrabold border-b-4 transition-transform active:translate-y-0.5 active:border-b-2
              ${answer === opt ? "bg-sky-500 border-sky-600 text-white" : "bg-white border-gray-200 text-gray-700"}
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function JournalQuestion({ q, answer, setAnswer }) {
  const update = (field, value) => setAnswer({ ...answer, [field]: value });
  const selectCls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-700 bg-white";
  const inputCls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-700";

  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">仕訳をつくろう</p>
      <div className="bg-gray-50 rounded-2xl p-4 mb-5">
        <p className="text-base font-bold text-gray-800">{q.prompt}</p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-extrabold text-gray-400 mb-1">借方</p>
          <div className="grid grid-cols-2 gap-2">
            <select className={selectCls} value={answer.debitAccount} onChange={(e) => update("debitAccount", e.target.value)}>
              <option value="">科目を選択</option>
              {ACCOUNTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              placeholder="金額"
              className={inputCls}
              value={answer.debitAmount}
              onChange={(e) => update("debitAmount", e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-extrabold text-gray-400 mb-1">貸方</p>
          <div className="grid grid-cols-2 gap-2">
            <select className={selectCls} value={answer.creditAccount} onChange={(e) => update("creditAccount", e.target.value)}>
              <option value="">科目を選択</option>
              {ACCOUNTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              placeholder="金額"
              className={inputCls}
              value={answer.creditAmount}
              onChange={(e) => update("creditAmount", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   仕訳穴埋め（単語バンク方式）
   借方・貸方のうち片側だけを空欄にし、反対側は答えとして最初から見せる。
   両側を空欄にすると埋める順番に迷うため、問う側を1つに絞っている。
   空欄が複数ある場合は、埋めたいセルをタップして選んでから語を入れる。
--------------------------------------------------------- */

// 空欄になっている側のセルだけを、上の行から順に返す
function journalSlots(q) {
  const slots = [];
  q.rows.forEach((r, ri) => {
    if (q.blankSide === "debit" && r.debitAnswer) {
      slots.push({ key: `d${ri}`, answer: r.debitAnswer });
    }
    if (q.blankSide === "credit" && r.creditAnswer) {
      slots.push({ key: `c${ri}`, answer: r.creditAnswer });
    }
  });
  return slots;
}

function JournalBlankQuestion({ q, answer, setAnswer }) {
  // 選択肢は毎回並び順を変えるが、同じ問題を解いている間は固定する
  const tokens = React.useMemo(
    () => shuffled(q.choices.map((label, i) => ({ id: `${q.id}::c${i}`, label }))),
    [q.id]
  );

  const slots = journalSlots(q);
  const placed = answer.slots || {};
  const usedIds = Object.values(placed).filter(Boolean);

  const [activeKey, setActiveKey] = useState(slots[0] ? slots[0].key : null);
  const tokenById = (id) => tokens.find((t) => t.id === id);

  // 埋める対象は、選択中のセル。未選択なら先頭の空きセル。
  const targetKey = () => {
    if (activeKey && !placed[activeKey]) return activeKey;
    const empty = slots.find((s) => !placed[s.key]);
    return empty ? empty.key : null;
  };

  const placeToken = (token) => {
    const key = targetKey();
    if (!key) return;
    const next = { ...placed, [key]: token.id };
    setAnswer({ slots: next });
    const nextEmpty = slots.find((s) => !next[s.key]);
    setActiveKey(nextEmpty ? nextEmpty.key : null);
  };

  const handleSlotTap = (key) => {
    if (placed[key]) {
      const next = { ...placed };
      delete next[key];
      setAnswer({ slots: next });
      setActiveKey(key);
      return;
    }
    setActiveKey(key);
  };

  const multiSlot = slots.length > 1;
  const sideLabel = q.blankSide === "debit" ? "借方" : "貸方";

  const AccountCell = ({ row, rowIndex, side }) => {
    const isDebit = side === "debit";
    const account = isDebit ? row.debitAnswer : row.creditAnswer;
    const amount = isDebit ? row.debitAmount : row.creditAmount;

    if (!account) return <div className="flex-1 px-3 py-3" />;

    const isBlank = q.blankSide === side;
    const key = `${isDebit ? "d" : "c"}${rowIndex}`;
    const token = isBlank && placed[key] ? tokenById(placed[key]) : null;
    const isActive = isBlank && multiSlot && targetKey() === key;

    return (
      <div className="flex-1 flex items-center gap-1 px-2 py-2 min-w-0">
        {isBlank ? (
          <button
            onClick={() => handleSlotTap(key)}
            className={`flex-1 min-w-0 min-h-10 py-1 rounded-xl text-sm font-extrabold px-1 leading-tight break-words transition-colors
              ${token ? "bg-sky-500 text-white" : "border-2 border-dashed text-gray-300"}
              ${!token && isActive ? "border-sky-400 bg-sky-50" : ""}
              ${!token && !isActive ? "border-gray-300" : ""}
            `}
          >
            {token ? token.label : "？"}
          </button>
        ) : (
          <span className="flex-1 min-w-0 min-h-10 flex items-center text-sm font-extrabold text-gray-700 px-1 leading-tight break-words">
            {account}
          </span>
        )}
        <span className="text-xs font-bold text-gray-600 shrink-0 tabular-nums">{amount.toLocaleString()}</span>
      </div>
    );
  };

  return (
    <div>
      <p className="text-sm text-gray-400 font-bold mb-2">
        {sideLabel}の勘定科目を入れよう
        {multiSlot && <span className="ml-1 text-gray-300">（入れたい欄をタップして選べます）</span>}
      </p>
      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <p className="text-base font-bold text-gray-800">{q.prompt}</p>
      </div>

      <div className="border-2 border-gray-200 rounded-2xl overflow-hidden mb-6">
        <div className="flex bg-gray-100 text-xs font-extrabold">
          <div className={`flex-1 px-3 py-2 border-r border-gray-200 ${q.blankSide === "debit" ? "text-sky-600" : "text-gray-400"}`}>
            借方
          </div>
          <div className={`flex-1 px-3 py-2 ${q.blankSide === "credit" ? "text-sky-600" : "text-gray-400"}`}>貸方</div>
        </div>
        {q.rows.map((r, ri) => (
          <div key={ri} className="flex border-t border-gray-200">
            <div className="flex-1 flex border-r border-gray-200 min-w-0">
              <AccountCell row={r} rowIndex={ri} side="debit" />
            </div>
            <div className="flex-1 flex min-w-0">
              <AccountCell row={r} rowIndex={ri} side="credit" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start content-start gap-2 justify-center min-h-24">
        {tokens.map((t) => {
          const used = usedIds.includes(t.id);
          // 使用中でも同じ大きさの枠を残し、他のボタンが動かないようにする
          return (
            <button
              key={t.id}
              disabled={used}
              onClick={() => placeToken(t)}
              className={`px-4 py-2 rounded-xl border-2 border-b-4 font-extrabold text-sm transition-transform
                ${
                  used
                    ? "bg-gray-100 border-gray-100 text-transparent"
                    : "bg-white border-gray-200 text-gray-700 active:translate-y-0.5 active:border-b-2"
                }
              `}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionRenderer({ q, answer, setAnswer }) {
  if (q.format === "classify") return <ClassifyQuestion q={q} answer={answer} setAnswer={setAnswer} />;
  if (q.format === "twochoice") return <TwoChoiceQuestion q={q} answer={answer} setAnswer={setAnswer} />;
  if (q.format === "fillblank") return <FillBlankQuestion q={q} answer={answer} setAnswer={setAnswer} />;
  if (q.format === "journal") return <JournalQuestion q={q} answer={answer} setAnswer={setAnswer} />;
  if (q.format === "journalBlank") return <JournalBlankQuestion q={q} answer={answer} setAnswer={setAnswer} />;
  return null;
}

function isAnswerReady(q, answer) {
  if (q.format === "journal") {
    return answer.debitAccount && answer.debitAmount !== "" && answer.creditAccount && answer.creditAmount !== "";
  }
  if (q.format === "journalBlank") {
    return journalSlots(q).every((s) => answer.slots && answer.slots[s.key]);
  }
  return answer !== null && answer !== undefined && answer !== "";
}

function gradeAnswer(q, answer) {
  if (q.format === "journal") {
    return (
      answer.debitAccount === q.debitAccount &&
      Number(answer.debitAmount) === q.debitAmount &&
      answer.creditAccount === q.creditAccount &&
      Number(answer.creditAmount) === q.creditAmount
    );
  }
  if (q.format === "journalBlank") {
    // 置かれた語のラベルが、そのセルの正解と一致するかを見る
    return journalSlots(q).every((s) => {
      const id = answer.slots && answer.slots[s.key];
      if (!id) return false;
      const idx = Number(String(id).split("::c")[1]);
      return q.choices[idx] === s.answer;
    });
  }
  return answer === q.answer;
}

function correctAnswerText(q) {
  if (q.format === "journal") {
    return `借方) ${q.debitAccount} ${q.debitAmount.toLocaleString()}円 ／ 貸方) ${q.creditAccount} ${q.creditAmount.toLocaleString()}円`;
  }
  if (q.format === "journalBlank") {
    return q.rows
      .map((r) => {
        const d = r.debitAnswer ? `${r.debitAnswer} ${r.debitAmount.toLocaleString()}` : "―";
        const c = r.creditAnswer ? `${r.creditAnswer} ${r.creditAmount.toLocaleString()}` : "―";
        return `${d} ／ ${c}`;
      })
      .join("、");
  }
  return q.answer;
}

function emptyAnswer(q) {
  if (q.format === "journal") return { debitAccount: "", debitAmount: "", creditAccount: "", creditAmount: "" };
  if (q.format === "journalBlank") return { slots: {} };
  return null;
}

/* ---------------------------------------------------------
   レッスン画面
--------------------------------------------------------- */

function LessonScreen({ node, hearts, onWrongAnswer, onExit, onComplete }) {
  const [queue, setQueue] = useState(() => shuffled(node.questions).map((q) => ({ ...q })));
  const [answer, setAnswer] = useState(() => emptyAnswer(queue[0]));
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [praise] = useState(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  const [masteredIds, setMasteredIds] = useState(new Set());
  const [missedIds, setMissedIds] = useState(new Set());
  const [confirmExit, setConfirmExit] = useState(false);

  const total = node.questions.length;
  const current = queue[0];
  const progress = Math.round((masteredIds.size / total) * 100);
  const started = masteredIds.size > 0 || missedIds.size > 0 || checked;

  const handleCheck = () => {
    const ok = gradeAnswer(current, answer);
    setCorrect(ok);
    setChecked(true);
    if (ok) {
      setMasteredIds((prev) => new Set(prev).add(current.id));
    } else {
      setMissedIds((prev) => new Set(prev).add(current.id));
      onWrongAnswer(current);
    }
  };

  const handleContinue = () => {
    if (hearts <= 0) return;
    const rest = queue.slice(1);
    const nextQueue = correct ? rest : [...rest, current];

    if (nextQueue.length === 0) {
      onComplete({ total, missed: missedIds.size });
      return;
    }
    setQueue(nextQueue);
    setAnswer(emptyAnswer(nextQueue[0]));
    setChecked(false);
  };

  // 途中まで解いていた場合のみ、離脱前に確認する
  const handleExitRequest = () => {
    if (started) {
      setConfirmExit(true);
      return;
    }
    onExit();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={handleExitRequest} className="text-gray-400" aria-label="レッスンを中断する">
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1">
            のこり{queue.length}問／全{total}問
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label={`ライフ${hearts}`}>
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
          <span className="font-extrabold text-sm text-red-500">{hearts}</span>
        </div>
      </div>

      <div className="flex-1 px-5 py-4">
        <QuestionRenderer q={current} answer={answer} setAnswer={setAnswer} />
      </div>

      <div className={`px-5 py-4 border-t ${checked ? (correct ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100") : "bg-gray-50 border-gray-100"}`}>
        {checked && (
          <div className="mb-3">
            <p className={`font-extrabold flex items-center gap-2 ${correct ? "text-green-600" : "text-red-500"}`}>
              {correct ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              {correct ? praise : "ざんねん"}
            </p>
            {!correct && (
              <p className="text-sm text-gray-600 mt-1">
                正解：<span className="font-bold">{correctAnswerText(current)}</span>
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1">{current.explanation}</p>
          </div>
        )}

        {!checked ? (
          <button
            disabled={!isAnswerReady(current, answer)}
            onClick={handleCheck}
            className={`w-full py-3 rounded-2xl font-extrabold border-b-4 transition-transform active:translate-y-0.5 active:border-b-2
              ${isAnswerReady(current, answer) ? "bg-green-500 border-green-600 text-white" : "bg-gray-200 border-gray-300 text-gray-400"}
            `}
          >
            こたえを確認
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className={`w-full py-3 rounded-2xl font-extrabold border-b-4 text-white transition-transform active:translate-y-0.5 active:border-b-2
              ${correct ? "bg-green-500 border-green-600" : "bg-red-500 border-red-600"}
            `}
          >
            つづける
          </button>
        )}
      </div>

      {confirmExit && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmExit(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-2xl p-5 shadow-xl">
            <p className="text-lg font-extrabold text-gray-800 mb-1">レッスンを中断しますか？</p>
            <p className="text-sm text-gray-500 mb-5">このレッスンの進み具合は保存されません。</p>
            <button
              onClick={onExit}
              className="w-full font-extrabold py-3 rounded-2xl border-b-4 bg-red-500 border-red-600 text-white active:translate-y-0.5 active:border-b-2 transition-transform mb-2"
            >
              中断する
            </button>
            <button onClick={() => setConfirmExit(false)} className="w-full font-extrabold py-3 rounded-2xl text-gray-500">
              レッスンにもどる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   まちがえた問題の復習画面
--------------------------------------------------------- */

function ReviewScreen({ wrongToday, onCorrect, onClose }) {
  const currentEntry = wrongToday[0] || null;
  const current = currentEntry ? currentEntry.question : null;

  const [answer, setAnswer] = useState(current ? emptyAnswer(current) : null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);

  useEffect(() => {
    setAnswer(current ? emptyAnswer(current) : null);
    setChecked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEntry?.key]);

  if (!current) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <Heart className="w-16 h-16 text-red-400 fill-red-400 mb-4" />
        <p className="text-xl font-extrabold text-gray-800 mb-2">今日の間違いはありません</p>
        <p className="text-gray-400 text-sm mb-8">ライフはフル回復しています</p>
        <button
          onClick={onClose}
          className="w-full max-w-xs bg-green-500 border-b-4 border-green-600 text-white font-extrabold py-3 rounded-2xl active:translate-y-0.5 active:border-b-2 transition-transform"
        >
          マップにもどる
        </button>
      </div>
    );
  }

  const handleCheck = () => {
    const ok = gradeAnswer(current, answer);
    setCorrect(ok);
    setChecked(true);
  };

  const handleContinue = () => {
    if (correct) {
      onCorrect(currentEntry.key);
      return;
    }
    setAnswer(emptyAnswer(current));
    setChecked(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-gray-400">
          <X className="w-6 h-6" />
        </button>
        <p className="flex-1 text-center font-extrabold text-gray-600 text-sm">まちがえた問題の復習・のこり{wrongToday.length}問</p>
        <div className="w-6" />
      </div>

      <div className="flex-1 px-5 py-4">
        <QuestionRenderer q={current} answer={answer} setAnswer={setAnswer} />
      </div>

      <div className={`px-5 py-4 border-t ${checked ? (correct ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100") : "bg-gray-50 border-gray-100"}`}>
        {checked && (
          <div className="mb-3">
            <p className={`font-extrabold flex items-center gap-2 ${correct ? "text-green-600" : "text-red-500"}`}>
              {correct ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              {correct ? "せいかい！ライフが回復に近づいた" : "もういちど挑戦しよう"}
            </p>
            {!correct && (
              <p className="text-sm text-gray-600 mt-1">
                正解：<span className="font-bold">{correctAnswerText(current)}</span>
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1">{current.explanation}</p>
          </div>
        )}

        {!checked ? (
          <button
            disabled={!isAnswerReady(current, answer)}
            onClick={handleCheck}
            className={`w-full py-3 rounded-2xl font-extrabold border-b-4 transition-transform active:translate-y-0.5 active:border-b-2
              ${isAnswerReady(current, answer) ? "bg-green-500 border-green-600 text-white" : "bg-gray-200 border-gray-300 text-gray-400"}
            `}
          >
            こたえを確認
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className={`w-full py-3 rounded-2xl font-extrabold border-b-4 text-white transition-transform active:translate-y-0.5 active:border-b-2
              ${correct ? "bg-green-500 border-green-600" : "bg-red-500 border-red-600"}
            `}
          >
            つづける
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   クリア / ハート切れ / 詳細画面
--------------------------------------------------------- */

function ClearScreen({ result, node, onContinue, onRetry }) {
  const accuracy = Math.round(((result.total - result.missed) / result.total) * 100);
  const xpEarned = result.total * 10;
  const isCheckpoint = node.kind === "checkpoint";
  const passed = accuracy >= PASS_RATE * 100;
  const failedCheckpoint = isCheckpoint && !passed;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white text-center">
      {failedCheckpoint ? (
        <Trophy className="w-20 h-20 text-gray-300 mb-4" />
      ) : (
        <Trophy className="w-20 h-20 text-amber-400 fill-amber-400 mb-4" />
      )}
      <p className="text-2xl font-extrabold text-gray-800 mb-1">
        {failedCheckpoint ? "もう一歩！" : "レッスンクリア！"}
      </p>
      <p className="text-gray-500 mb-6">{node.title}</p>

      {isCheckpoint && (
        <div className={`mb-6 px-4 py-2 rounded-full font-extrabold text-sm ${passed ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
          {passed ? "合格ライン突破！" : `正答率${PASS_RATE * 100}%以上で合格です`}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8">
        <div className="bg-amber-50 rounded-2xl py-4">
          <p className="text-amber-500 font-extrabold text-lg">+{xpEarned}</p>
          <p className="text-xs text-gray-400 font-bold">XP</p>
        </div>
        <div className={`rounded-2xl py-4 ${passed ? "bg-green-50" : "bg-red-50"}`}>
          <p className={`font-extrabold text-lg ${passed ? "text-green-600" : "text-red-500"}`}>{accuracy}%</p>
          <p className="text-xs text-gray-400 font-bold">正解率</p>
        </div>
      </div>

      {failedCheckpoint ? (
        <>
          <button
            onClick={onRetry}
            className="w-full max-w-xs bg-green-500 border-b-4 border-green-600 text-white font-extrabold py-3 rounded-2xl active:translate-y-0.5 active:border-b-2 transition-transform mb-3"
          >
            もう一度挑戦する
          </button>
          <button onClick={onContinue} className="text-gray-400 font-bold text-sm">
            あとでマップにもどる
          </button>
        </>
      ) : (
        <button
          onClick={onContinue}
          className="w-full max-w-xs bg-green-500 border-b-4 border-green-600 text-white font-extrabold py-3 rounded-2xl active:translate-y-0.5 active:border-b-2 transition-transform"
        >
          つづける
        </button>
      )}
    </div>
  );
}

function HeartsEmptyScreen({ onReview, onBackToMap }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white text-center">
      <Heart className="w-20 h-20 text-gray-300 mb-4" />
      <p className="text-xl font-extrabold text-gray-800 mb-2">ライフがなくなりました</p>
      <p className="text-gray-500 mb-8 text-sm">まちがえた問題を復習するとライフが回復します</p>
      <button
        onClick={onReview}
        className="w-full max-w-xs bg-green-500 border-b-4 border-green-600 text-white font-extrabold py-3 rounded-2xl active:translate-y-0.5 active:border-b-2 transition-transform mb-3"
      >
        まちがえた問題を復習する
      </button>
      <button onClick={onBackToMap} className="text-gray-400 font-bold text-sm">
        あとでマップにもどる
      </button>
    </div>
  );
}

function StreakDetailScreen({ streak, lastActiveDate, onClose }) {
  const today = new Date();
  const anchor = lastActiveDate && lastActiveDate !== todayStr() ? new Date(lastActiveDate + "T00:00:00") : today;
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const todayDate = today.getDate();
  const anchorDate = anchor.getDate();

  const activeDays = new Set();
  for (let i = 0; i < streak; i++) {
    const d = anchorDate - i;
    if (d >= 1) activeDays.add(d);
  }

  const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="min-h-screen bg-white px-5 py-4">
      <DetailHeader title="継続記録" onClose={onClose} />
      <div className="flex flex-col items-center mb-8">
        <Flame className="w-16 h-16 text-orange-500 fill-orange-500 mb-2" />
        <p className="text-3xl font-extrabold text-gray-800">{streak}日連続</p>
        <p className="text-gray-400 text-sm mt-1">毎日クリアして記録を伸ばそう</p>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekLabels.map((w) => (
          <span key={w} className="text-xs font-bold text-gray-400">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            {d && (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${d === todayDate ? "ring-2 ring-orange-500" : ""}
                  ${activeDays.has(d) ? "bg-orange-100 text-orange-600" : "text-gray-400"}
                `}
              >
                {d}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressDetailScreen({ solvedCount, totalXp, completedSets, onResetData, onClose }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="min-h-screen bg-white px-5 py-4 flex flex-col">
      <DetailHeader title="学習の記録" onClose={onClose} />
      <div className="flex flex-col items-center mb-6">
        <Gem className="w-16 h-16 text-sky-500 mb-2" />
        <p className="text-3xl font-extrabold text-gray-800">{solvedCount}問</p>
        <p className="text-gray-400 text-sm mt-1">これまでにクリアした問題数（全コース合計）</p>
      </div>

      <div className="bg-amber-50 rounded-2xl py-3 mb-6 text-center">
        <p className="text-amber-500 font-extrabold text-xl">{totalXp.toLocaleString()} XP</p>
        <p className="text-xs text-gray-400 font-bold">累計獲得XP</p>
      </div>

      <div className="space-y-2">
        {COURSES.map((c) => {
          const set = completedSets[c.id];
          const count = c.nodes.reduce((sum, n, i) => (set.has(i) ? sum + n.questions.length : sum), 0);
          return (
            <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <span className="font-bold text-gray-600">{c.title}</span>
              <span className="font-extrabold text-sky-500">{count}問</span>
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-8 flex flex-col items-center">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="text-gray-300 text-xs font-bold underline">
            この端末の学習データをリセット
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-bold">元に戻せません。削除しますか？</span>
            <button onClick={onResetData} className="text-xs font-extrabold text-red-500">
              削除する
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs font-extrabold text-gray-400">
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   コース選択画面
--------------------------------------------------------- */

function CourseSelectScreen({ activeCourseId, completedSets, onSelect, onClose }) {
  return (
    <div className="min-h-screen bg-white px-5 py-4">
      <DetailHeader title="コースをえらぶ" onClose={onClose} />
      <div className="space-y-3">
        {COURSES.map((c) => {
          const done = completedSets[c.id].size;
          const total = c.nodes.length;
          const active = c.id === activeCourseId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left rounded-2xl p-4 border-2 transition-colors ${active ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-extrabold text-gray-800">{c.title}</p>
                {active && <span className="text-xs font-extrabold text-green-600 bg-white px-2 py-0.5 rounded-full">学習中</span>}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{c.subtitle}</p>
              <p className="text-xs text-gray-400 mt-2 font-bold">
                {done}/{total} レッスン完了
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   マップ画面
--------------------------------------------------------- */

function getNodeState(index, completedSet, frontier) {
  if (completedSet.has(index)) return "completed";
  if (index === frontier) return "current";
  return "locked";
}

function MapScreen({ nodes, chapters, stubNote, completedSet, frontier, sheetIndex, onTapNode, onStart, onCloseSheet }) {
  const currentRef = React.useRef(null);

  // 31レッスンあるため、開いたときに現在地まで自動で送る
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ block: "center", behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 章ごとの進捗を先に集計する
  const chapterStats = {};
  nodes.forEach((n, i) => {
    if (!chapterStats[n.chapter]) chapterStats[n.chapter] = { done: 0, total: 0 };
    chapterStats[n.chapter].total += 1;
    if (completedSet.has(i)) chapterStats[n.chapter].done += 1;
  });

  let lastChapter = null;
  let lastUnit = null;

  return (
    <div className="px-6 pt-6 pb-16 flex flex-col items-center">
      {nodes.map((node, i) => {
        const state = getNodeState(i, completedSet, frontier);
        const isNewChapter = node.chapter !== lastChapter;
        const isNewUnit = node.unit !== lastUnit;
        const el = (
          <React.Fragment key={node.id}>
            {isNewChapter && <SectionBanner info={chapters[node.chapter]} stats={chapterStats[node.chapter]} />}
            {!isNewChapter && isNewUnit && node.unit && <UnitDivider label={node.unit} />}
            <div ref={state === "current" ? currentRef : null} className="flex flex-col items-center">
              <PathNode node={node} index={i} state={state} onTap={onTapNode} />
            </div>
          </React.Fragment>
        );
        lastChapter = node.chapter;
        lastUnit = node.unit;
        return el;
      })}

      <div className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-4 text-center mt-2">
        <p className="text-sm font-bold text-gray-400">{stubNote}</p>
      </div>

      {sheetIndex !== null && (
        <NodeSheet
          node={nodes[sheetIndex]}
          state={getNodeState(sheetIndex, completedSet, frontier)}
          onStart={() => onStart(sheetIndex)}
          onClose={onCloseSheet}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   ルートコンポーネント
--------------------------------------------------------- */

export default function BokiDuolingoMock() {
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("map");
  // map | lesson | clear | heartsEmpty | streakDetail | progressDetail | review | courseSelect

  const [activeCourseId, setActiveCourseId] = useState("accounts");
  const [completedSets, setCompletedSets] = useState({
    accounts: new Set(),
    journalBlank: new Set(),
    tac: new Set(),
    pattern: new Set(),
  });
  const [activeNodeIndex, setActiveNodeIndex] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [attemptId, setAttemptId] = useState(0); // 挑戦ごとに出題順を引き直すためのキー

  const [streak, setStreak] = useState(0);
  const [lastActiveDate, setLastActiveDate] = useState(null);
  const [solvedCount, setSolvedCount] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [wrongToday, setWrongToday] = useState([]); // { key, nodeTitle, question }[]
  const [wrongTodayDate, setWrongTodayDate] = useState(todayStr());

  const hearts = Math.max(0, 5 - wrongToday.length);

  const currentCourse = COURSES.find((c) => c.id === activeCourseId);
  const currentNodes = currentCourse.nodes;
  const currentCompletedSet = completedSets[activeCourseId];

  let frontier = currentNodes.length;
  for (let i = 0; i < currentNodes.length; i++) {
    if (!currentCompletedSet.has(i)) {
      frontier = i;
      break;
    }
  }

  // 初回読み込み：保存済みの進捗があれば復元する
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadProgress();
      if (cancelled) return;

      if (data) {
        const today = todayStr();

        const restoredCompletedSets = {
          accounts: new Set(data.completedSets?.accounts || []),
          journalBlank: new Set(data.completedSets?.journalBlank || []),
          tac: new Set(data.completedSets?.tac || []),
          pattern: new Set(data.completedSets?.pattern || []),
        };

        let restoredStreak = data.streak || 0;
        if (data.lastActiveDate && daysBetween(data.lastActiveDate, today) >= 2) {
          restoredStreak = 0; // 2日以上あいたら連続記録は途切れる
        }

        const restoredWrongToday = data.wrongTodayDate === today ? data.wrongToday || [] : [];

        // 保存後にコース構成が変わっている場合に備え、存在するIDだけ採用する
        const savedCourseId = COURSES.some((c) => c.id === data.activeCourseId) ? data.activeCourseId : "accounts";

        setActiveCourseId(savedCourseId);
        setCompletedSets(restoredCompletedSets);
        setSolvedCount(data.solvedCount || 0);
        setTotalXp(data.totalXp || 0);
        setStreak(restoredStreak);
        setLastActiveDate(data.lastActiveDate || null);
        setWrongToday(restoredWrongToday);
        setWrongTodayDate(today);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hearts === 0 && screen === "lesson") {
      const t = setTimeout(() => setScreen("heartsEmpty"), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongToday, screen]);

  // 今日はじめての学習かどうかを判定し、連続記録を更新した結果を返す
  const bumpStreak = (today) => {
    if (lastActiveDate === today) {
      return { nextStreak: streak, nextLastActiveDate: lastActiveDate };
    }
    const nextStreak = lastActiveDate && daysBetween(lastActiveDate, today) === 1 ? streak + 1 : 1;
    return { nextStreak, nextLastActiveDate: today };
  };

  const handleStart = (i) => {
    setSheetIndex(null);
    setActiveNodeIndex(i);
    setAttemptId((n) => n + 1);
    setScreen("lesson");
  };

  const handleWrongAnswer = (question, nodeTitle) => {
    if (wrongToday.some((w) => w.key === question.id)) return;
    const today = todayStr();
    const nextWrongToday = [...wrongToday, { key: question.id, nodeTitle, question }];

    setWrongToday(nextWrongToday);
    setWrongTodayDate(today);

    saveProgress({
      activeCourseId,
      completedSets,
      solvedCount,
      totalXp,
      streak,
      lastActiveDate,
      wrongToday: nextWrongToday,
      wrongTodayDate: today,
    });
  };

  const handleReviewCorrect = (key) => {
    const today = todayStr();
    const nextWrongToday = wrongToday.filter((w) => w.key !== key);
    const nextSolvedCount = solvedCount + 1;
    const nextTotalXp = totalXp + 5; // 復習の正解にも少しXPを付ける
    const { nextStreak, nextLastActiveDate } = bumpStreak(today);

    setWrongToday(nextWrongToday);
    setSolvedCount(nextSolvedCount);
    setTotalXp(nextTotalXp);
    setStreak(nextStreak);
    setLastActiveDate(nextLastActiveDate);
    setWrongTodayDate(today);

    saveProgress({
      activeCourseId,
      completedSets,
      solvedCount: nextSolvedCount,
      totalXp: nextTotalXp,
      streak: nextStreak,
      lastActiveDate: nextLastActiveDate,
      wrongToday: nextWrongToday,
      wrongTodayDate: today,
    });
  };

  const handleLessonComplete = (result) => {
    setLastResult(result);

    const today = todayStr();
    const node = currentNodes[activeNodeIndex];
    const accuracy = (result.total - result.missed) / result.total;
    // チェックポイントは合格ラインに届かないとクリア扱いにしない
    const cleared = node.kind !== "checkpoint" || accuracy >= PASS_RATE;

    const nextCompletedSets = cleared
      ? { ...completedSets, [activeCourseId]: new Set(completedSets[activeCourseId]).add(activeNodeIndex) }
      : completedSets;
    const nextSolvedCount = solvedCount + result.total;
    const nextTotalXp = totalXp + result.total * 10;
    const { nextStreak, nextLastActiveDate } = bumpStreak(today);

    setCompletedSets(nextCompletedSets);
    setSolvedCount(nextSolvedCount);
    setTotalXp(nextTotalXp);
    setStreak(nextStreak);
    setLastActiveDate(nextLastActiveDate);
    setScreen("clear");

    saveProgress({
      activeCourseId,
      completedSets: nextCompletedSets,
      solvedCount: nextSolvedCount,
      totalXp: nextTotalXp,
      streak: nextStreak,
      lastActiveDate: nextLastActiveDate,
      wrongToday,
      wrongTodayDate,
    });
  };

  const handleClearContinue = () => {
    setActiveNodeIndex(null);
    setScreen("map");
  };

  // チェックポイント不合格からの再挑戦
  const handleRetry = () => {
    setLastResult(null);
    setAttemptId((n) => n + 1);
    setScreen("lesson");
  };

  const handleSelectCourse = (id) => {
    setActiveCourseId(id);
    setSheetIndex(null);
    setActiveNodeIndex(null);
    setScreen("map");

    saveProgress({
      activeCourseId: id,
      completedSets,
      solvedCount,
      totalXp,
      streak,
      lastActiveDate,
      wrongToday,
      wrongTodayDate,
    });
  };

  const handleResetData = async () => {
    await clearProgress();
    setActiveCourseId("accounts");
    setCompletedSets({ accounts: new Set(), journalBlank: new Set(), tac: new Set(), pattern: new Set() });
    setSolvedCount(0);
    setTotalXp(0);
    setStreak(0);
    setLastActiveDate(null);
    setWrongToday([]);
    setWrongTodayDate(todayStr());
    setActiveNodeIndex(null);
    setSheetIndex(null);
    setScreen("map");
  };

  if (!loaded) {
    return (
      <div className="max-w-sm mx-auto min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 font-bold text-sm">よみこみ中…</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen bg-white font-sans">
      {screen === "map" && (
        <>
          <Header
            courseTitle={currentCourse.title}
            streak={streak}
            solvedCount={solvedCount}
            hearts={hearts}
            onOpenCourses={() => setScreen("courseSelect")}
            onOpenStreak={() => setScreen("streakDetail")}
            onOpenProgress={() => setScreen("progressDetail")}
            onOpenReview={() => setScreen("review")}
          />
          <MapScreen
            nodes={currentNodes}
            chapters={currentCourse.chapters}
            stubNote={currentCourse.stubNote}
            completedSet={currentCompletedSet}
            frontier={frontier}
            sheetIndex={sheetIndex}
            onTapNode={(i) => setSheetIndex(i)}
            onStart={handleStart}
            onCloseSheet={() => setSheetIndex(null)}
          />
        </>
      )}

      {screen === "lesson" && activeNodeIndex !== null && (
        <LessonScreen
          key={`${activeCourseId}-${activeNodeIndex}-${attemptId}`}
          node={currentNodes[activeNodeIndex]}
          hearts={hearts}
          onWrongAnswer={(q) => handleWrongAnswer(q, currentNodes[activeNodeIndex].title)}
          onExit={() => setScreen("map")}
          onComplete={handleLessonComplete}
        />
      )}

      {screen === "clear" && lastResult && activeNodeIndex !== null && (
        <ClearScreen
          result={lastResult}
          node={currentNodes[activeNodeIndex]}
          onContinue={handleClearContinue}
          onRetry={handleRetry}
        />
      )}

      {screen === "heartsEmpty" && (
        <HeartsEmptyScreen
          onReview={() => setScreen("review")}
          onBackToMap={() => {
            setActiveNodeIndex(null);
            setScreen("map");
          }}
        />
      )}

      {screen === "streakDetail" && (
        <StreakDetailScreen streak={streak} lastActiveDate={lastActiveDate} onClose={() => setScreen("map")} />
      )}

      {screen === "progressDetail" && (
        <ProgressDetailScreen
          solvedCount={solvedCount}
          totalXp={totalXp}
          completedSets={completedSets}
          onResetData={handleResetData}
          onClose={() => setScreen("map")}
        />
      )}

      {screen === "review" && <ReviewScreen wrongToday={wrongToday} onCorrect={handleReviewCorrect} onClose={() => setScreen("map")} />}

      {screen === "courseSelect" && (
        <CourseSelectScreen
          activeCourseId={activeCourseId}
          completedSets={completedSets}
          onSelect={handleSelectCourse}
          onClose={() => setScreen("map")}
        />
      )}
    </div>
  );
}
