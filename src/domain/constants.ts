import type { Element } from "./types.ts";

export const ACCOUNTS: string[] = [
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

export const ELEMENTS: Element[] = ["資産", "負債", "純資産", "収益", "費用"];

export const PRAISE = ["せいかい！", "いいね！", "そのとおり！", "ばっちり！"];

export const PASS_RATE = 0.7; // チェックポイントの合格ライン
export const MAX_HEARTS = 5;
export const XP_PER_QUESTION = 10;
export const XP_PER_REVIEW = 5;
