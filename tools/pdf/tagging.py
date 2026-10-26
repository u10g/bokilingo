"""抽出した問題に論点IDを付け、出題数を集計する。

画面や外部コマンドに依存しない純粋関数だけを置き、test_tagging.py で検証する。
タグ付けはキーワード規則で候補を出し、確信度の低いものだけをClaudeが確認する。
タグは docs/data/tags.csv に保存する。問題文は保存しない（ID・出典・論点・自分で書いた要約のみ）。
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

# 論点ID → (問題文のキーワード, 選択肢の勘定科目)。
# キーワードは (正規表現, 重み)。同じ規則は何回出てきても1回と数える。
# 選択肢には誤答の科目も並ぶため、選択肢の一致は弱い手がかり（重み1）として使う
RULES: dict[str, tuple[list[tuple[str, int]], list[str]]] = {
    "sales-basic": ([(r"(売掛金|掛代金|掛け代金).{0,12}回収", 2), (r"振込手数料", 2), (r"掛けで(売り上げ|仕入れ)", 1)], []),
    "sales-extra": (
        [(r"返品|品違い|(?<!振り)戻し|(?<!から)戻り", 4), (r"手付金|内金", 4), (r"クレジット|クレジツト", 4), (r"運賃|発送費|送料", 3), (r"商品券", 3)],
        ["クレジット売掛金", "発送費", "受取商品券"],
    ),
    "cash-deposit": (
        [(r"当座借越|借越", 3), (r"口座を開設|開設", 3), (r"普通預金口座から現金|引き出", 3), (r"銀行の.{0,6}口座|銀行.{0,8}振り替", 4), (r"定期預金", 2), (r"残高を超え|限度額", 3), (r"当座", 1)],
        ["当座借越", "定期預金"],
    ),
    "cash-short": ([(r"現金過不足|過不足", 5), (r"手許有高", 3), (r"小口現金|定額資金前渡", 12), (r"実査", 4), (r"実際有高", 3)], ["現金過不足", "小口現金"]),
    "notes": ([(r"手形", 3), (r"電子記録", 5)], ["電子記録債権", "電子記録債務", "受取手形", "支払手形", "手形貸付金", "手形借入金"]),
    "loans": (
        [(r"貸し付け|貸付", 3), (r"借り入れ|借入", 3), (r"借用証書", 2), (r"消耗品.{0,20}後日支払", 2)],
        ["貸付金", "借入金", "未収入金"],
    ),
    "payroll": ([(r"給料", 3), (r"源泉", 4), (r"社会保険|健康保険|厚生年金", 4), (r"所得税", 2)], ["所得税預り金", "社会保険料預り金", "法定福利費"]),
    "suspense": ([(r"仮払", 4), (r"仮受", 4), (r"内容不明", 4), (r"概算", 3), (r"出張", 2)], ["仮払金", "仮受金"]),
    "expenses": (
        [(r"収入印紙|郵便切手", 3), (r"電話|通信", 2), (r"事務用|文房具|コピー用紙", 3), (r"立て替え|立替", 2), (r"旅費交通費", 2), (r"電気|ガス|水道", 2)],
        ["租税公課", "通信費", "消耗品費", "旅費交通費", "水道光熱費"],
    ),
    "rent": ([(r"敷金|差入保証金", 5), (r"家賃|地代|賃借料", 3), (r"賃貸借|賃借", 2), (r"駐車場", 2), (r"仲介", 2)], ["差入保証金", "支払家賃", "支払地代"]),
    "services": ([(r"手数料を受け取", 3), (r"保険料", 2), (r"商品券", 1)], ["受取手数料", "保険料"]),
    "fixed-assets": (
        [(r"土地|建物|備品|車両|機械", 2), (r"改良|修繕|資本的支出", 4), (r"売却", 3), (r"購入手数料|付随費用|据付", 2)],
        ["固定資産売却益", "固定資産売却損", "修繕費"],
    ),
    "depreciation": ([(r"減価償却を行う|定額法", 5), (r"耐用年数", 3)], ["減価償却費"]),
    "bad-debts": ([(r"貸倒|貸し倒", 5), (r"倒産", 4), (r"償却債権", 5)], ["貸倒損失", "貸倒引当金", "償却債権取立益"]),
    "accruals": (
        [(r"未収|未払(?!金)|前払(?!金)|前受(?!金)", 3), (r"(未払|前払|前受|未収)(分|額)|未経過", 4), (r"再振替|振り戻", 2), (r"経過", 2), (r"月割", 1)],
        ["未収利息", "未払利息", "前払保険料", "前受家賃", "未払給料", "前払利息", "未収家賃"],
    ),
    "closing": (
        [(r"損益勘定|損益に振り替", 5), (r"売上原価", 4), (r"棚卸高", 3), (r"期末商品", 3), (r"貯蔵品", 6), (r"未使用", 2)],
        ["損益", "貯蔵品", "売上原価"],
    ),
    "consumption-tax": ([(r"消費税", 4), (r"税抜", 3)], ["仮払消費税", "仮受消費税", "未払消費税"]),
    "corporate-tax": ([(r"法人税", 5), (r"中間申告|中間納付", 3)], ["仮払法人税等", "未払法人税等", "法人税等"]),
    "equity": ([(r"株主総会|配当", 5), (r"株式.{0,10}発行|設立|増資", 5), (r"利益準備金", 3)], ["資本金", "利益準備金", "未払配当金", "繰越利益剰余金"]),
    "correction": ([(r"誤って|誤り|訂正|誤記|未処理|記帳.{0,6}行われ|修正する|仕訳を行っていた", 6)], []),
    "slips": ([(r"伝票", 6)], []),
}

# 旧範囲（2022年度適用の出題区分表より前）に出ていた論点の手がかり。
# 公式の区分表と照合できていないため、自動で除外はせず「要確認」にするだけ
OLD_SCOPE = re.compile(r"分記法|有価証券|為替手形|裏書|手形.{0,4}割引|売上割引|仕入割引")

# 第2問・第3問の形式としての論点。第1問の出題数の表では、0件でも行を出さない
FORMAT_TOPICS = {"subledger", "inventory-ledger", "statements", "worksheet", "ledger-entry", "fs-preparation"}

MIN_SCORE = 4  # これ未満は「候補なし」
MIN_MARGIN = 2  # 1位と2位の差がこれ未満なら「要確認」

TAG_FIELDS = ["id", "book", "scope", "kai", "daimon", "sub", "no", "cited", "topic", "by", "dup_of", "note"]


@dataclass
class Suggestion:
    topic: str | None
    sure: bool
    ranked: list[tuple[str, int]] = field(default_factory=list)
    old_scope: bool = False


def score(prompt: str, choices: list[str]) -> list[tuple[str, int]]:
    """論点ごとの点数を高い順に返す（0点の論点は除く）。"""
    out = []
    for topic, (keywords, accounts) in RULES.items():
        s = sum(w for pat, w in keywords if re.search(pat, prompt))
        s += sum(1 for a in accounts if a in choices)
        if s:
            out.append((topic, s))
    return sorted(out, key=lambda kv: -kv[1])


def suggest(prompt: str, choices: list[str]) -> Suggestion:
    ranked = score(prompt, choices)
    old = bool(OLD_SCOPE.search(prompt))
    if not ranked or ranked[0][1] < MIN_SCORE:
        return Suggestion(None, False, ranked, old)
    margin = ranked[0][1] - (ranked[1][1] if len(ranked) > 1 else 0)
    return Suggestion(ranked[0][0], margin >= MIN_MARGIN and not old, ranked, old)


# ---------------------------------------------------------
# 重複の判定
# ---------------------------------------------------------

_STRIP = re.compile(r"[\s\d,，.．¥￥()（）「」、。・:：%％@＠\-ー一]")


def shingles(text: str, n: int = 3) -> set[str]:
    """金額や記号を除いた文字の n-gram。改題で金額だけ変えた問題も同じとみなすため。"""
    t = _STRIP.sub("", text)
    return {t[i : i + n] for i in range(max(0, len(t) - n + 1))}


def similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


DUP_THRESHOLD = 0.6


def find_duplicates(questions: list[dict]) -> dict[str, str]:
    """{問題ID: 先に出てきた同じ問題のID} を返す。並び順で先に出たものを残す。

    第1問（1問ずつ独立した取引）は、次のどちらかなら同じ問題とみなす。
      - 設問まで書かれた出典（「サンプル問題3-問14」）が同じ
      - 問題文の類似度が DUP_THRESHOLD 以上（出典が書かれていない改題）
    第2問・第3問は「消費税の処理を行う」のような定型文が多く、文の類似では判定できない。
    別の本・別の回に同じ大問の出典（「第147回第5問」）があれば、同じ番号の設問を同じ問題とみなす。
    questions は id・book・kai・daimon・sub・no・prompt・cited を持つ dict。
    """
    dup: dict[str, str] = {}
    first_by_key: dict[tuple, str] = {}
    seen: list[tuple[str, set[str]]] = []
    for q in questions:
        cites = q.get("cited", [])
        if q.get("daimon") == 1:
            keys = [("q", c) for c in cites if "-問" in c]
        else:
            keys = [("d", c, q.get("daimon"), q.get("sub"), q.get("no")) for c in cites if "-問" not in c]
        hit = next((first_by_key[k] for k in keys if k in first_by_key), None)
        if hit is None and q.get("daimon") == 1:
            sh = shingles(q.get("prompt", ""))
            if len(sh) >= 15:
                hit = next((oid for oid, other in seen if similarity(sh, other) >= DUP_THRESHOLD), None)
                if hit is None:
                    seen.append((q["id"], sh))
        if hit is not None:
            dup[q["id"]] = hit
            continue
        for k in keys:
            first_by_key.setdefault(k, q["id"])
    return dup


# ---------------------------------------------------------
# tags.csv の読み書き
# ---------------------------------------------------------


def read_tags(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_tags(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted(rows, key=sort_key)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=TAG_FIELDS, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in TAG_FIELDS})


def sort_key(r: dict) -> tuple:
    def num(v: str) -> int:
        return int(v) if v and v.isdigit() else -1

    return (r["book"], num(r["kai"]), num(r["daimon"]), num(r["sub"]), num(r["no"]))


def merge_tags(old: list[dict], new: list[dict]) -> list[dict]:
    """新しく付けた自動タグを既存の表に反映する。手で付けたタグ（by=manual）は上書きしない。"""
    by_id = {r["id"]: r for r in old}
    for r in new:
        cur = by_id.get(r["id"])
        if cur and cur.get("by") == "manual":
            # 抽出し直しで変わりうる項目だけ更新する
            cur.update({k: r[k] for k in ("cited", "dup_of", "scope") if k in r})
            continue
        by_id[r["id"]] = {**(cur or {}), **r}
    return list(by_id.values())


# ---------------------------------------------------------
# 集計
# ---------------------------------------------------------


def counted(rows: list[dict], topic_ids: set[str]) -> list[dict]:
    """集計の対象にする行。要確認・重複・論点なし・範囲外（論点マスタにない論点）を除く。"""
    return [r for r in rows if r.get("by") in ("auto", "manual") and r.get("topic") in topic_ids and not r.get("dup_of")]


def frequency(rows: list[dict], topic_ids: set[str], daimon: str = "1") -> list[tuple[str, list[dict]]]:
    """第1問の設問を論点ごとにまとめ、出題数の多い順に返す。"""
    groups: dict[str, list[dict]] = {}
    for r in counted(rows, topic_ids):
        if r["daimon"] == daimon and r["no"] not in ("", "0"):
            groups.setdefault(r["topic"], []).append(r)
    return sorted(groups.items(), key=lambda kv: -len(kv[1]))


def rounds_by_topic(rows: list[dict], topic_ids: set[str], daimon: str = "3") -> list[tuple[str, list[str]]]:
    """第3問の決算整理事項について、論点ごとに出てきた回を返す（同じ回の重複は1回）。"""
    groups: dict[str, set[tuple[str, str]]] = {}
    for r in counted(rows, topic_ids):
        if r["daimon"] == daimon and r["no"] not in ("", "0"):
            groups.setdefault(r["topic"], set()).add((r["book"], r["kai"]))
    return sorted(((t, [f"{k}" for _, k in sorted(v, key=lambda x: (x[0], int(x[1] or 0)))]) for t, v in groups.items()), key=lambda kv: -len(kv[1]))


def load_topics(ts_path: Path) -> dict[str, str]:
    """src/content/topics.ts から {論点ID: 論点名} を読む。"""
    text = ts_path.read_text(encoding="utf-8")
    return dict(re.findall(r'\{\s*id:\s*"([\w-]+)",\s*title:\s*"([^"]+)"', text))
