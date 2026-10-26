import type { ChapterInfo } from "../../domain/types.ts";
import type { LegacyNode } from "./types.ts";

/* ---------------------------------------------------------
   コース3: 思考パターン別コース

   TAC目次のような単元別ではなく、「なぜその仕訳になるのか」という
   判断の型でグルーピングした構成（このアプリ独自の分類）。
   パターン1: 交換取引（資産⇄資産・負債⇄負債の入れ替えのみ）
   パターン2: 損益取引（収益・費用が発生する）
   パターン3: 一時的な勘定科目（内容・金額が未確定なものを仮に受け止める）
   ※ 見越し・繰延べ／資産の振替パターンは準備中
--------------------------------------------------------- */

export const PATTERN_CHAPTERS: Record<string, ChapterInfo> = {
  pat1: { title: "パターン 1", subtitle: "交換取引", bg: "bg-rose-500", sub: "text-rose-100" },
  pat2: { title: "パターン 2", subtitle: "損益取引", bg: "bg-orange-500", sub: "text-orange-100" },
  pat3: { title: "パターン 3", subtitle: "一時的な勘定科目", bg: "bg-fuchsia-500", sub: "text-fuchsia-100" },
};

export const PATTERN_NODES: LegacyNode[] = [
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
