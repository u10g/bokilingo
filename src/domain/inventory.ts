/* ---------------------------------------------------------
   商品有高帳の計算（問題とストーリーで共通）
   取引の一覧から、移動平均法・先入先出法で帳簿の全行を計算する。
   列は「日付・摘要／欄（受入・払出・残高）／数量／単価／金額」。
   本試験の9列（受入・払出・残高 × 数量・単価・金額）はスマホに収まらないため、欄を行に分けている。
--------------------------------------------------------- */

const yen = (n: number) => n.toLocaleString("en-US");

export type InvMethod = "移動平均法" | "先入先出法";
// [日付, 取引, 数量, 単価]。売上の単価は売価（帳簿には原価で記入する）
// 返品は [日付, 取引, 数量, 元の取引の日付]。単価は元の取引から決まる（仕入戻しは仕入単価、売上戻りは払出単価＝原価）
export type InvTx =
  | [date: string, kind: "前月繰越" | "仕入" | "売上", qty: number, price: number]
  | [date: string, kind: "仕入戻し" | "売上戻り", qty: number, ref: string];
export type InvSection = "受入" | "払出" | "残高";
export type InvCol = "q" | "p" | "a";
export interface InvRow {
  date: string;
  kind: InvTx[1];
  section: InvSection;
  q: number;
  p: number;
  a: number;
}

export function inventoryRows(method: InvMethod, txs: InvTx[]): InvRow[] {
  const rows: InvRow[] = [];
  let lots: { q: number; p: number }[] = [];
  const pushBalance = (date: string, kind: InvTx[1]) => {
    if (method === "移動平均法") {
      const q = lots.reduce((t, l) => t + l.q, 0);
      const a = lots.reduce((t, l) => t + l.q * l.p, 0);
      if (q > 0 && a % q !== 0) throw new Error(`${date}: 平均単価 ${a}÷${q} が割り切れない`);
      const p = q > 0 ? a / q : 0;
      lots = q > 0 ? [{ q, p }] : [];
      rows.push({ date, kind, section: "残高", q, p, a });
    } else {
      for (const l of lots) rows.push({ date, kind, section: "残高", q: l.q, p: l.p, a: l.q * l.p });
    }
  };
  for (const tx of txs) {
    const [date, kind, qty] = tx;
    if (tx[1] === "仕入戻し") {
      // 仕入戻しは払出欄に、仕入れたときの単価で記入する。先入先出法では、その単価の在庫から減らす
      const p = refTx(txs, tx[3], "仕入")[3];
      rows.push({ date, kind, section: "払出", q: qty, p, a: qty * p });
      if (method === "移動平均法") {
        // 残高の計算で数量と金額から差し引く（平均単価は pushBalance で計算し直す）
        lots.push({ q: -qty, p });
      } else {
        const lot = [...lots].reverse().find((l) => l.p === p);
        if (!lot || lot.q < qty) throw new Error(`${date}: 戻す在庫が足りない`);
        lot.q -= qty;
        lots = lots.filter((l) => l.q > 0);
      }
    } else if (tx[1] === "売上戻り") {
      // 売上戻りは受入欄に、払い出したときの単価（原価）で記入する。先入先出法は戻す在庫の位置が決まらないので扱わない
      if (method !== "移動平均法") throw new Error(`${date}: 売上戻りは移動平均法だけで扱う`);
      const out = rows.filter((r) => r.date === tx[3] && r.kind === "売上" && r.section === "払出");
      if (out.length !== 1) throw new Error(`${date}: ${tx[3]} の払出がない`);
      const p = out[0].p;
      rows.push({ date, kind, section: "受入", q: qty, p, a: qty * p });
      lots.push({ q: qty, p });
    } else if (kind === "売上") {
      let rest = qty;
      while (rest > 0) {
        const lot = lots[0];
        if (!lot) throw new Error(`${date}: 在庫が足りない`);
        const take = Math.min(rest, lot.q);
        rows.push({ date, kind, section: "払出", q: take, p: lot.p, a: take * lot.p });
        lot.q -= take;
        rest -= take;
        if (lot.q === 0) lots.shift();
      }
    } else {
      const price = tx[3] as number;
      rows.push({ date, kind, section: "受入", q: qty, p: price, a: qty * price });
      lots.push({ q: qty, p: price });
    }
    pushBalance(date, kind);
  }
  return rows;
}

// 返品の元になった取引
export function refTx(txs: InvTx[], date: string, kind: "仕入" | "売上") {
  const hit = txs.find((t): t is [string, "仕入" | "売上", number, number] => t[0] === date && t[1] === kind);
  if (!hit) throw new Error(`${date} の${kind}がない`);
  return hit;
}

const jpDate = (date: string) => {
  const [m, d] = date.split("/");
  return `${m}月${d}日`;
};

// 本試験と同じく「6月8日 仕入 30個 @¥160」の形で書く。返品は「6月10日 仕入戻し 5個（6月8日仕入分）」
export const txLine = (tx: InvTx) => {
  const [date, kind, qty] = tx;
  if (tx[1] === "仕入戻し" || tx[1] === "売上戻り") return `${jpDate(date)} ${kind} ${qty}個（${jpDate(tx[3])}${tx[1] === "仕入戻し" ? "仕入" : "売上"}分）`;
  return `${jpDate(date)} ${kind} ${qty}個 @¥${yen(tx[3] as number)}${kind === "売上" ? "（売価）" : ""}`;
};

// 返品があるときは、本試験と同じく記入する欄を「なお、」で指示する
export const returnNote = (txs: InvTx[]) => {
  const kinds = new Set(txs.map((t) => t[1]));
  const parts = [kinds.has("仕入戻し") && "仕入戻しは払出欄", kinds.has("売上戻り") && "売上戻りは受入欄"].filter(Boolean);
  return parts.length ? [`なお、${parts.join("に、")}に記入する。`] : [];
};

// 入力の順番。移動平均法で仕入れた・返品した後の残高は、数量と金額を足し引きしてから単価を割り出す
export function cellOrder(method: InvMethod, r: InvRow): InvCol[] {
  const recalc = r.kind === "仕入" || r.kind === "仕入戻し" || r.kind === "売上戻り";
  return method === "移動平均法" && r.section === "残高" && recalc ? ["q", "a", "p"] : ["q", "p", "a"];
}

// 売上高・売上原価。売上戻りは売上高から売価で、売上原価から原価で差し引く。仕入戻しは払出欄に書くが売上原価ではない
export function inventorySummary(method: InvMethod, txs: InvTx[]): { sales: number; cost: number } {
  const sales = txs.reduce((t, tx) => {
    if (tx[1] === "売上") return t + tx[2] * tx[3];
    if (tx[1] === "売上戻り") return t - tx[2] * refTx(txs, tx[3], "売上")[3];
    return t;
  }, 0);
  const cost = inventoryRows(method, txs).reduce((t, r) => {
    if (r.kind === "売上" && r.section === "払出") return t + r.a;
    if (r.kind === "売上戻り" && r.section === "受入") return t - r.a;
    return t;
  }, 0);
  return { sales, cost };
}
