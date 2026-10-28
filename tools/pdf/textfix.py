"""searchable PDF（ABBYY OCR）の文字データを補正し、問題単位に分割する。

画面や外部コマンドに依存しない純粋関数だけを置き、test_textfix.py で検証する。
OCRの誤りは「直せるもの」と「直せないもの」に分ける。
  - 直せるもの：選択肢記号（エ→工 など）、¥→早、数字中の〇 など → 機械的に補正
  - 直せないもの：㎡ の化け、見出しの回数 など → flags を付けて、必要なら画像で確認する
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# 選択肢記号と、OCRで取り違えやすい文字
CHOICE_MARKERS = "アイウエオカキクケコ"
MARKER_CONFUSIONS: dict[str, str] = {
    "ア": "アァ",
    "イ": "イ",
    "ウ": "ウ",
    "エ": "エ工ェ",
    "オ": "オ才札",
    "カ": "カ力丸ヵ",
    "キ": "キ",
    "ク": "ク",
    "ケ": "ケ",
    "コ": "コ",
}
SEPARATORS = ".．・,，、 　"
MAX_CHOICE_LEN = 14  # 「法人税、住民税及び事業税」が12文字

# OCRが紛れ込ませる、本文に出てこない文字
ODD_CHARS = re.compile(r"[?？;；:：囂鷺辭讯瓦”“’!！…^「」|]")
# 数字の直後に英字や化けた単位が続く（例：550㎡ → 5508、1㎡ → 111T）
UNIT_SUSPECT = re.compile(r"\d[A-Za-z讯瓦]|あたり|当たり|㎡|平方メートル")


def normalize_line(s: str) -> str:
    """どの行にも安全に適用できる補正だけを行う。"""
    s = s.replace("￥", "¥")
    s = re.sub(r"早(?=\s?\d)", "¥", s)
    # 金額中の 〇 / O を 0 に（26,00〇 → 26,000）
    s = re.sub(r"(?<=[\d,])[〇O](?=[\d,]|\b|$)", "0", s)
    # 1.320,000 のように桁区切りがピリオドに化けたもの
    s = re.sub(r"(?<=\d)\.(?=\d{3},\d{3})", ",", s)
    return s


def _marker_at(s: str, i: int, expected: str) -> int:
    """s[i] が期待する選択肢記号（の取り違え）なら、記号と区切りを読み飛ばした位置を返す。"""
    if i >= len(s) or s[i] not in MARKER_CONFUSIONS[expected]:
        return -1
    j = i + 1
    while j < len(s) and s[j] in SEPARATORS:
        j += 1
    return j


def parse_choices(s: str, start_marker: str = "ア") -> list[tuple[str, str]] | None:
    """「ア.現金イ・売掛金ウ.買掛金…」形式の行を [(記号, 科目)] に分解する。

    記号はア→イ→ウ…の順に現れる前提で、次に来るべき記号だけを探す。
    これにより、科目名の中のカタカナを記号と取り違えにくくする。
    選択肢の行でなければ None を返す。
    """
    body = s.strip()
    k = CHOICE_MARKERS.index(start_marker)
    pos = _marker_at(body, 0, CHOICE_MARKERS[k])
    # 先頭の記号には区切りが必須（「アルバイト」などを記号と誤認しない）
    if pos < 0 or pos == 1:
        return None

    items: list[tuple[str, str]] = []
    while True:
        nxt = CHOICE_MARKERS[k + 1] if k + 1 < len(CHOICE_MARKERS) else None
        end = len(body)
        next_pos = -1
        if nxt:
            # 科目名は2文字以上（「土地」「建物」）なので、記号の直後1文字は探さない
            for i in range(pos + 2, len(body)):
                p = _marker_at(body, i, nxt)
                if 0 <= p < len(body):
                    end, next_pos = i, p
                    break
        label = body[pos:end].strip(SEPARATORS)
        if not label or len(label) > MAX_CHOICE_LEN:
            return None
        items.append((CHOICE_MARKERS[k], label))
        if next_pos < 0:
            break
        k += 1
        pos = next_pos

    # 1行に1つずつ並ぶ組版もあるため、1項目だけの行も認める。
    # 科目名は MAX_CHOICE_LEN 以下なので、「ア．…」で始まる長い文は弾かれる
    return items


# 「(第145回第2問)」の出典表記を大問の見出しと取り違えないよう、直前が「回」のものは除く。
# 見出しには隣の文字が1つ紛れ込むことがある（例：「第答I問」）
# 大きな見出しは「第」だけ別の行に分かれることがあるため、行頭の「2問」も見出しとみなす
def leading_marker(s: str) -> str | None:
    """行頭が「記号＋区切り」なら、その記号（取り違えを正した形）を返す。"""
    body = s.lstrip()
    for marker, variants in MARKER_CONFUSIONS.items():
        if body[:1] and body[0] in variants and len(body) > 1 and body[1] in SEPARATORS:
            return marker
    return None


# 「第1問」の「1」は「［」「|」などに化けることがある（例：「第［問」）。この形は1とみなす
DAIMON = re.compile(
    r"(?<![回\d])第\s*[^\d\s回]?\s*([1-5１-５IlⅠⅡⅢ])\s*[問間]|^\s*([1-5１-５IlⅠⅡⅢ])\s*[問間]|(?<![回\d])第\s*([［\[｜|!！])\s*[問間]"
)
# 「1.6月に…」は設問番号、「1.320,000」は金額。ピリオドの後に3桁が続くものは除く。
# 区切りが読み落とされた「9消費税の…」も拾うが、「9月30日」のような日付は除く
QUESTION_NO = re.compile(
    r"^\s*(\d{1,2}|[〇O])\s*(?:[.．・\-,，\"”]\s*(?!\d{3}|\d{1,2},\d{3})|(?=[^\d\s.,．、月日年か%％円]))"
)
MAX_SKIP = 2  # 設問番号の読み落としを、この数まで飛ばして追従する
DAIMON1_MAX = 15  # 第1問の設問数（現行の出題形式）
# 第3問の柱書き（「次の(1)決算整理前残高試算表および(2)決算整理事項等にもとづいて…」）。見出しが読めないときに使う
DAIMON3_LEAD = re.compile(r"次の.{0,30}(決算整理|残高試算表)")
DAIMON3_LEAD_LINES = 6  # ページの先頭から何行以内にあれば柱書きとみなすか


def match_question_no(line: str, expected: int) -> tuple[int, int] | None:
    """行頭の設問番号を読み、(設問番号, 番号の終わりの位置) を返す。

    OCRの読み違いを補正する:
      - 2桁の番号の先頭の「1」が落ちる（14. → 4.）
      - 0 が 〇 になる（10. → 〇.）
      - 1問まるごと読めない（7 が無く 8 から始まる）→ MAX_SKIP 問まで飛ばす
    """
    m = QUESTION_NO.match(line)
    if not m:
        return None
    raw = m.group(1)
    if raw in "〇O":
        return (expected, m.end()) if expected % 10 == 0 else None
    n = int(raw)
    if expected <= n <= expected + MAX_SKIP:
        return n, m.end()
    if expected >= 10 and n == expected % 10:
        return expected, m.end()
    return None


# 第2問の小問「(1)」「⑴」。⑴ は行頭にゴミが付くことがあるので行内のどこでも拾う
SUB_NO = re.compile(r"^\s*[(（]\s*([1-3])\s*[)）]|([⑴⑵⑶])")
# 出典。第1問は「(サンプル問題3-問14)」のように設問まで書かれる（「-」は「一」に化けやすい）
_CITED_NO = r"(?:\s*[一\-ー－—‐~〜]?\s*問\s*(\d{1,2}))?"
CITED_EXAM = re.compile(r"第\s*(\d{2,3})\s*回\s*第\s*(\d)\s*問" + _CITED_NO)
CITED_SAMPLE = re.compile(r"サンプル問題\s*(\d)(?:\s*[一\-ー－—‐]?\s*第\s*\d\s*問)?" + _CITED_NO)


def citations(line: str) -> list[str]:
    """行内の出典表記を「第145回第2問」「サンプル問題3-問14」の形で返す。"""
    out = [f"第{m.group(1)}回第{m.group(2)}問" + (f"-問{m.group(3)}" if m.group(3) else "") for m in CITED_EXAM.finditer(line)]
    out += [f"サンプル問題{m.group(1)}" + (f"-問{m.group(2)}" if m.group(2) else "") for m in CITED_SAMPLE.finditer(line)]
    return out

_ROMAN = {"I": 1, "l": 1, "Ⅰ": 1, "Ⅱ": 2, "Ⅲ": 3}


def daimon_number(s: str) -> int | None:
    m = DAIMON.search(s)
    if not m:
        return None
    c = m.group(1) or m.group(2)  # group(3) は化けた「1」
    if c is None or c in _ROMAN:
        return _ROMAN.get(c, 1)
    return int(c.translate(str.maketrans("１２３４５", "12345")))


def line_flags(s: str) -> list[str]:
    flags = []
    if UNIT_SUSPECT.search(s):
        flags.append("unit")  # 単位まわりの数値が化けている可能性
    if len(ODD_CHARS.findall(s)) >= 2:
        flags.append("noisy")
    return flags


@dataclass
class Question:
    daimon: int | None
    no: int | None
    page: int
    sub: int | None = None  # 第2問などの小問 (1)(2)
    lines: list[str] = field(default_factory=list)
    choices: list[tuple[str, str]] = field(default_factory=list)
    flags: set[str] = field(default_factory=set)
    cited: list[str] = field(default_factory=list)

    @property
    def prompt(self) -> str:
        return "".join(x.strip() for x in self.lines)


# 行が分かれた見出しと設問番号（スキャンの読み順で、数字だけが別の行になる）
_HEADING_NO_DIGIT = re.compile(r"^\s*第\s*問\s*$")  # 「第 問」の次の行が「1」
_HEADING_ODD_DIGIT = re.compile(r"^\s*[^\d\s第回]\s*問\s*$")  # 「N問」の前後の行が「第」だけ
_LONE_DIGIT = re.compile(r"^\s*([1-9]|1[0-9])\s*$")
_CONTINUES_NO = re.compile(r"^\s*[,，.．・\-]")  # 「1」の次の行が「,新田商店に…」
# 第3問の決算整理事項を「①②…」で番号付けする回がある。番号だけが1行になることも多い
_CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"
_LONE_CIRCLED = re.compile(rf"^\s*['’]?\s*([{_CIRCLED}])\s*$")
_LEADING_CIRCLED = re.compile(rf"^\s*['’]?\s*([{_CIRCLED}])")


def merge_split_lines(pages: list[list[str]]) -> list[list[str]]:
    """分かれて読まれた大問の見出しと設問番号を、1行に戻す。

    - 「第 問」＋「1」 → 「第1問」
    - 「N問」＋「第」（数字が化けた見出し） → 直前の大問の次の番号の見出し
    - 「1」＋「,新田商店に…」 → 「1,新田商店に…」
    """
    last = 0
    out: list[list[str]] = []
    for lines in pages:
        ls = [x for x in lines]
        res: list[str] = []
        i = 0
        while i < len(ls):
            line, nxt = ls[i], (ls[i + 1] if i + 1 < len(ls) else "")
            prev = res[-1] if res else ""
            if _HEADING_NO_DIGIT.match(line) and _LONE_DIGIT.match(nxt):
                line, i = f"第{nxt.strip()}問", i + 1
            elif _HEADING_ODD_DIGIT.match(line) and (nxt.strip() == "第" or prev.strip() == "第"):
                if prev.strip() == "第":
                    res.pop()
                elif nxt.strip() == "第":
                    i += 1
                line = f"第{last + 1}問" if last < 5 else line
            elif _LONE_DIGIT.match(line) and _CONTINUES_NO.match(nxt):
                line, i = line.strip() + nxt.strip(), i + 1
            elif _LONE_CIRCLED.match(line) and nxt.strip() and not _LONE_CIRCLED.match(nxt):
                line, i = line.strip() + nxt.strip(), i + 1
            d = daimon_number(line)
            if d is not None:
                last = d
            res.append(line)
            i += 1
        out.append(res)
    return out


def split_questions(pages: list[list[str]]) -> list[Question]:
    """補正済みの行（ページごと）を、大問・設問単位にまとめる。

    設問番号は 1, 2, 3… と連番で現れる前提で、次の番号だけを設問の始まりとみなす。
    本文中の「1.320,000」や「3月」を設問番号と取り違えないため。
    """
    out: list[Question] = []
    daimon: int | None = None
    daimon_page = 0  # 今の大問が始まったページ
    expected_no = 1
    expected_sub = 1
    cur: Question | None = None

    def flush() -> None:
        nonlocal cur
        if cur and (cur.lines or cur.choices or cur.flags):
            out.append(cur)
        cur = None

    for page_no, lines in enumerate(merge_split_lines(pages), start=1):
        for line_no, raw in enumerate(lines):
            line = normalize_line(raw)
            if not line.strip():
                continue

            d = daimon_number(line)
            # 見出しが読めなかったときの補い。
            # 第2問：第1問の15問の後に小問「(1)」が来たら、第2問が始まっている
            # 第3問：第2問の次のページの先頭に「次の…決算整理…にもとづいて」があれば、第3問の柱書き
            if d is None and daimon == 1 and expected_no > DAIMON1_MAX and SUB_NO.search(line):
                daimon, daimon_page, expected_no, expected_sub = 2, page_no, 1, 1
                flush()
            if d is None and daimon == 2 and page_no > daimon_page and line_no < DAIMON3_LEAD_LINES and DAIMON3_LEAD.search(line):
                d = 3
            if d is not None and d != daimon:
                # 「⑴」が見出しより先に読まれた場合は、その小問ごと新しい大問に移す
                if cur and cur.sub == 1 and cur.page == page_no and len(cur.lines) <= 2 and (daimon is None or d > daimon):
                    daimon, daimon_page, expected_no, expected_sub = d, page_no, 1, 2
                    cur.daimon = d
                    m = DAIMON.search(line)
                    cur.lines.append(line[m.end():] if m else line)
                    continue
                flush()
                # 大問番号が戻ったら解答・解説のページに入ったとみなし、そこで打ち切る
                if daimon is not None and d < daimon:
                    return _finish(out)
                daimon, daimon_page, expected_no, expected_sub = d, page_no, 1, 1
                cur = Question(daimon, None, page_no)  # 大問の柱書き
                m = DAIMON.search(line)
                cur.lines.append(line[m.end():] if m else line)
                continue


            # 第3問の「①」は設問番号「1.」として読む
            if daimon == 3:
                line = _LEADING_CIRCLED.sub(lambda m: f"{_CIRCLED.index(m.group(1)) + 1}.", line, count=1)

            sm = SUB_NO.search(line)
            sub = (int(sm.group(1)) if sm.group(1) else "⑴⑵⑶".index(sm.group(2)) + 1) if sm else None
            # (1) を読み落としても (2) で区切れるよう、期待値以上なら受け入れる
            if sub is not None and sub >= expected_sub:
                flush()
                cur = Question(daimon, None, page_no, sub=sub)
                expected_sub = sub + 1
                expected_no = 1
                line = line[sm.end():]

            qm = match_question_no(line, expected_no)
            # 第1問は15問まで。それより後の「16」などは、問題文中の表（請求書など）の数字
            if qm and daimon == 1 and qm[0] > DAIMON1_MAX:
                qm = None
            if qm:
                no, end = qm
                flush()
                sub_no = cur.sub if cur else None
                # 読めなかった設問は、画像で確認できるよう欠落として残す
                for missing in range(expected_no, no):
                    out.append(Question(daimon, missing, page_no, sub=sub_no, flags={"missing"}))
                cur = Question(daimon, no, page_no, sub=sub_no)
                expected_no = no + 1
                line = line[end:]

            if cur is None:
                cur = Question(daimon, None, page_no)

            # 「(第145回第2問)」のような出典表記は、問題の末尾に書かれる。
            # 設問番号と同じ行にあれば、その設問のもの
            cur.cited += citations(line)

            # 選択肢の行。OCRの読み順が前後することがあるため、行頭の記号から読み始め、
            # 最後に記号順へ並べ直す（leading_marker が None なら選択肢の行ではない）
            start = leading_marker(line)
            choices = parse_choices(line, start) if (start and cur.lines) else None
            if choices:
                known = dict(cur.choices)
                known.update(choices)
                cur.choices = sorted(known.items(), key=lambda kv: CHOICE_MARKERS.index(kv[0]))
            else:
                cur.lines.append(line)
            cur.flags.update(line_flags(line))
    flush()
    return _finish(out)


def _finish(questions: list[Question]) -> list[Question]:
    # 第1問の見出しが読めず、最初に見つかった見出しが第2問なら、それより前は第1問とみなす
    first = next((q.daimon for q in questions if q.daimon is not None), None)
    if first == 2:
        for q in questions:
            if q.daimon is None:
                q.daimon = 1
    recover_inline(questions)
    spread_citations(questions)
    return questions


def recover_inline(questions: list[Question]) -> None:
    """読み落とした設問を、ほかの設問の文中から取り戻す。

    表と本文が入り組んだページでは、「…判明した。3.当座預金勘定の…」のように
    設問番号が行の途中に来て、前の設問に吸収されることがある。
    同じ大問・小問の設問の文中に「。3.」があれば、そこから後ろを設問3とする。
    表の文字が混ざっていることが多いため、recovered の印を付ける。
    """
    for q in questions:
        if "missing" not in q.flags or not q.no:
            continue
        pat = re.compile(rf"[。)）]\s*{q.no}\s*[.．,，]\s*(?!\d)")
        for host in questions:
            if host is q or host.daimon != q.daimon or host.sub != q.sub or not host.no:
                continue
            m = pat.search(host.prompt)
            if m:
                text = host.prompt
                host.lines = [text[: m.start() + 1]]
                q.lines = [text[m.end() :]]
                q.page = host.page
                q.flags = {"recovered"}
                break


def spread_citations(questions: list[Question]) -> None:
    """出典表記は大問・小問の末尾に1回だけ書かれるため、同じ大問の前の設問へさかのぼって付ける。

    さかのぼる途中で別の出典を持つ設問に当たったら、そこから先はその出典を使う
    （第2問の小問(1)(2)がそれぞれ別の回から出題されている場合）。
    設問まで書かれた出典（「-問14」付き）は、その設問だけのものなので広げない。
    """
    carry: list[str] = []
    daimon: int | None = None
    for q in reversed(questions):
        if q.daimon != daimon:
            daimon, carry = q.daimon, []
        if q.cited:
            carry = [c for c in q.cited if "-問" not in c]
        else:
            q.cited = list(carry)
