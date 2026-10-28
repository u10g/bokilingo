#!/usr/bin/env python3
"""参考書のsearchable PDFから、Claudeが少ないトークンで読める中間データを作る。

使い方（抽出結果は references/ 以下。著作物のためコミットしない）:

  python3 tools/pdf/prep.py ingest ~/uploads/*.pdf [--scope old]  # 改名・保管・抽出をまとめて行う
  python3 tools/pdf/prep.py extract tac-mondai-02-q.pdf      # 文字データの抽出・補正・問題分割
  python3 tools/pdf/prep.py status                           # 取り込み済みの本と、タグ付けの進み具合
  python3 tools/pdf/prep.py list references/tac-mondai-02-q  # 問題を1行ずつの要約で表示
  python3 tools/pdf/prep.py tag                              # 論点を自動で付け、要確認の問題だけ表示
  python3 tools/pdf/prep.py tag --set tac-mondai-02-1-7=notes:電子記録債権の発生  # 手で論点を付ける
  python3 tools/pdf/prep.py tag --set tac-mondai-02-1-9=closing --not-dup tac-mondai-02-1-9  # 重複の誤判定を取り消す
  python3 tools/pdf/prep.py stats --write                    # 出題数を集計し、docs/topic-map.md を更新
  python3 tools/pdf/prep.py crop tac-mondai-02-q.pdf --page 8 [--table]  # ページ（の表部分）を画像に

タグ（論点ID・出典・自分で書いた要約）は docs/data/tags.csv に保存し、コミットする。

ファイル名は <書名>-<回>-<q|a>.pdf とする。出典（回）はOCRではなくファイル名から取る。
見出しの「第2回」が「第4回」と読まれるなど、OCRの見出しは信用できないため。

外部依存は poppler-utils（pdftotext / pdftoppm / pdfinfo）のみ。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tagging import (  # noqa: E402
    FORMAT_TOPICS,
    NOT_DUP,
    counted,
    find_duplicates,
    frequency,
    is_dup,
    load_topics,
    merge_tags,
    read_tags,
    rounds_by_topic,
    suggest,
    write_tags,
)
from textfix import line_flags, normalize_line, split_questions  # noqa: E402

DEFAULT_OUT = Path("references")
ROOT = Path(__file__).resolve().parents[2]
TAGS = ROOT / "docs" / "data" / "tags.csv"
TOPICS_TS = ROOT / "src" / "content" / "topics.ts"
TOPIC_MAP = ROOT / "docs" / "topic-map.md"
UPLOAD_PREFIX = re.compile(r"^[0-9a-f]{8}-")  # チャットにアップロードしたファイルに付く接頭辞
NS = {"x": "http://www.w3.org/1999/xhtml"}
AMOUNT = re.compile(r"^\d{1,3}(,\d{3})+$")
TABLE_MIN_AMOUNTS = 12  # 金額がこれ以上並ぶページは表とみなす


@dataclass
class SourceMeta:
    book: str
    kai: int | None
    kind: str  # q（問題）| a（解答）| ?
    scope: str = "current"  # current（2022年度適用の区分表）| old（それより前の範囲）

    @classmethod
    def from_filename(cls, path: Path) -> "SourceMeta":
        parts = path.stem.split("-")
        kind = parts[-1] if parts[-1] in ("q", "a") else "?"
        nums = [p for p in parts if re.fullmatch(r"\d{1,3}", p)]
        if nums:
            kai = int(nums[-1])
            book = "-".join(p for p in parts if p not in (nums[-1], kind))
        else:
            # 命名規則に沿わない名前（例：02rtest）は先頭の数字を回とみなす
            m = re.search(r"\d{1,3}", path.stem)
            kai = int(m.group()) if m else None
            book = path.stem
        return cls(book=book, kai=kai, kind=kind)


def join_words(words: list[ET.Element]) -> str:
    """単語を連結する。OCRは日本語の文中でも単語を区切るため、隙間が小さければ空白を入れない。"""
    out = ""
    prev_x1 = None
    for w in words:
        x0 = float(w.get("xMin"))
        if prev_x1 is not None and x0 - prev_x1 > 4.0:
            out += " "
        out += w.text or ""
        prev_x1 = float(w.get("xMax"))
    return out


def read_lines(pdf: Path) -> list[tuple[float, float, list[str]]]:
    """pdftotext -bbox-layout の行を、ページごとに読み順（flow → block → line）で返す。

    左の余白にある「第1問 45点」は独立したブロックになるため、
    y座標で行をまとめ直すと本文と混ざる。読み順はOCRの判定に任せる。
    """
    xml = subprocess.run(["pdftotext", "-bbox-layout", str(pdf), "-"], capture_output=True, check=True).stdout
    # 本文に & などが混じるとXMLとして壊れるため、実体参照に逃がす
    xml = re.sub(rb"&(?![a-zA-Z]+;|#\d+;)", b"&amp;", xml)
    root = ET.fromstring(xml)
    pages = []
    for page in root.iter("{http://www.w3.org/1999/xhtml}page"):
        lines = [join_words(ln.findall("x:word", NS)) for ln in page.iter("{http://www.w3.org/1999/xhtml}line")]
        pages.append((float(page.get("width")), float(page.get("height")), lines))
    return pages


def table_region(pdf: Path, page_no: int, width: float) -> list[float] | None:
    """金額の単語が多いページについて、その範囲（勘定科目の列まで含む）を返す。"""
    xml = subprocess.run(
        ["pdftotext", "-bbox", "-f", str(page_no), "-l", str(page_no), str(pdf), "-"], capture_output=True, check=True
    ).stdout
    words = re.findall(rb'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', xml)
    amounts = [w for w in words if AMOUNT.match(w[4].decode("utf-8", "replace"))]
    if len(amounts) < TABLE_MIN_AMOUNTS:
        return None
    y0 = min(float(w[1]) for w in amounts)
    y1 = max(float(w[3]) for w in amounts)
    pad = 12.0
    return [0.0, max(0.0, y0 - pad * 3), width, y1 + pad]


def question_id(meta: SourceMeta, q) -> str:
    """書名-回-大問-小問-設問。設問番号のない柱書きは 0 とする。"""
    kai = f"{meta.kai:02d}" if meta.kai is not None else "xx"
    sub = f"({q.sub})" if q.sub else ""
    return f"{meta.book}-{kai}-{q.daimon or 0}{sub}-{q.no or 0}"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cmd_extract(args: argparse.Namespace) -> None:
    for pdf in map(Path, args.pdf):
        extract_one(pdf, args)


def extract_one(pdf: Path, args: argparse.Namespace) -> None:
    out = Path(args.out) / pdf.stem
    digest = sha256(pdf)
    meta_path = out / "meta.json"
    if meta_path.exists() and not args.force and json.loads(meta_path.read_text(encoding="utf-8"))["sha256"] == digest:
        print(f"{pdf.name}: 抽出済み（--force で再実行）")
        return
    out.mkdir(parents=True, exist_ok=True)

    meta = SourceMeta.from_filename(pdf)
    if args.book:
        meta.book = args.book
    if args.kai is not None:
        meta.kai = args.kai
    if args.kind:
        meta.kind = args.kind
    meta.scope = args.scope

    pages = read_lines(pdf)
    page_lines: list[list[str]] = []
    with (out / "pages.jsonl").open("w", encoding="utf-8") as f:
        for i, (w, h, raw) in enumerate(pages, start=1):
            lines = [normalize_line(x) for x in raw]
            page_lines.append(raw)
            rec = {
                "page": i,
                "size": [round(w, 1), round(h, 1)],
                "table": table_region(pdf, i, w),
                "flagged": [{"line": j, "flags": fl} for j, ln in enumerate(lines) if (fl := line_flags(ln))],
                "text": lines,
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    n_q = 0
    if meta.kind != "a":
        questions = split_questions(page_lines)
        with (out / "questions.jsonl").open("w", encoding="utf-8") as f:
            for q in questions:
                rec = {
                    "id": question_id(meta, q),
                    "book": meta.book,
                    "kai": meta.kai,
                    "daimon": q.daimon,
                    "sub": q.sub,
                    "no": q.no,
                    "page": q.page,
                    "prompt": q.prompt,
                    "choices": [c for _, c in q.choices],
                    "cited": sorted(set(q.cited)),
                    "flags": sorted(q.flags),
                }
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                n_q += 1

    meta_path.write_text(
        json.dumps({"source": pdf.name, "sha256": digest, **meta.__dict__, "pages": len(pages)}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    with (out / "pages.jsonl").open(encoding="utf-8") as f:
        recs = [json.loads(x) for x in f]
    tables = [r["page"] for r in recs if r["table"]]
    flagged = sum(len(r["flagged"]) for r in recs)
    print(f"{pdf.name}: {len(pages)}ページ / 問題{n_q}件 / 表のあるページ{tables} / 要確認の行{flagged}件 → {out}")


def cmd_list(args: argparse.Namespace) -> None:
    """問題を1行ずつ表示する。Claudeが論点を付けるときはこれを読む。"""
    for d in map(Path, args.dir):
        qf = d / "questions.jsonl"
        if not qf.exists():
            print(f"{d}: questions.jsonl がない（解答ファイルか未抽出）", file=sys.stderr)
            continue
        for line in qf.open(encoding="utf-8"):
            q = json.loads(line)
            prompt = q["prompt"] if not args.width or len(q["prompt"]) <= args.width else q["prompt"][: args.width] + "…"
            choices = "/".join(q["choices"])
            mark = f" [{','.join(q['flags'])}]" if q["flags"] else ""
            print(f"{q['id']} p{q['page']}{mark}\t{prompt}\t{choices}")

def cmd_ingest(args: argparse.Namespace) -> None:
    """アップロードされたPDFを references/pdf/ に命名規則どおりの名前で置き、抽出する。

    フォルダを渡すと、中の *.pdf をすべて対象にする。名前の先頭のアップロード用の接頭辞は外す。
    """
    pdf_dir = Path(args.out) / "pdf"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    sources: list[Path] = []
    for p in map(Path, args.src):
        sources += sorted(p.glob("*.pdf")) if p.is_dir() else [p]
    for src in sources:
        dest = pdf_dir / UPLOAD_PREFIX.sub("", src.name)
        if not re.fullmatch(r"[\w-]+-\d{1,3}-[qa]\.pdf", dest.name) and not args.book:
            print(f"{src.name}: 名前が <書名>-<回>-<q|a>.pdf でないため飛ばす（--book と --kai で指定する）", file=sys.stderr)
            continue
        if src.resolve() != dest.resolve():
            shutil.copy2(src, dest)
        extract_one(dest, args)


def extracted_dirs(out: Path, only: list[str] | None = None) -> list[Path]:
    """抽出済みの本（問題ファイル）を、現行範囲 → 旧範囲、書名、回の順で返す。

    重複の判定では先に出たものを残すため、現行範囲の本を先にする。
    """
    dirs = [Path(d) for d in only] if only else [m.parent for m in out.glob("*/meta.json")]
    metas = []
    for d in dirs:
        meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
        if meta["kind"] != "a" and (d / "questions.jsonl").exists():
            metas.append((meta.get("scope", "current") != "current", meta["book"], meta["kai"] or 0, d))
    return [m[3] for m in sorted(metas)]


def load_questions(d: Path) -> tuple[dict, list[dict]]:
    meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
    with (d / "questions.jsonl").open(encoding="utf-8") as f:
        return meta, [json.loads(x) for x in f]


def taggable(q: dict) -> bool:
    """自動でタグを付ける問題。第1問の各設問と、第3問の決算整理事項。"""
    return q["daimon"] in (1, 3) and bool(q["no"])


def cmd_status(args: argparse.Namespace) -> None:
    """取り込み済みの本ごとに、問題数・読み落とし・タグ付けの進み具合を表で出す。"""
    tags = {r["id"]: r for r in read_tags(Path(args.tags))}
    print("| 本 | 範囲 | 第1問 | 読み落とし | タグ済み | 要確認 | 重複 |")
    print("|---|---|---|---|---|---|---|")
    for d in extracted_dirs(Path(args.out)):
        meta, qs = load_questions(d)
        targets = [q for q in qs if taggable(q)]
        rows = [tags[q["id"]] for q in targets if q["id"] in tags]
        print(
            f"| {d.name} | {meta.get('scope', 'current')} | {sum(1 for q in targets if q['daimon'] == 1)}"
            f" | {sum(1 for q in targets if 'missing' in q['flags'])}"
            f" | {sum(1 for r in rows if r['by'] in ('auto', 'manual'))}/{len(targets)}"
            f" | {sum(1 for r in rows if r['by'] == 'review')} | {sum(1 for r in rows if is_dup(r))} |"
        )


def parse_set(spec: str) -> tuple[str, str, str]:
    """「ID=論点[:要約]」を分解する。論点を「-」にすると集計から外す（範囲外など）。"""
    qid, _, rest = spec.partition("=")
    topic, _, note = rest.partition(":")
    return qid.strip(), topic.strip(), note.strip()


def cmd_tag(args: argparse.Namespace) -> None:
    """論点を自動で付けて tags.csv に反映し、確認が要る問題だけを1行ずつ表示する。

    確信度の高いものは by=auto、低いもの（候補が拮抗、読み落とし、旧範囲の手がかり）は by=review。
    review は集計に含めない。確認したら --set で by=manual にする。
    """
    tags_path = Path(args.tags)
    topics = load_topics(TOPICS_TS)
    rows = read_tags(tags_path)

    if args.set or args.not_dup:
        by_id = {r["id"]: r for r in rows}
        for qid in args.not_dup or []:
            if qid not in by_id:
                sys.exit(f"{qid}: tags.csv にない（先に tag を実行する）")
            by_id[qid].update({"dup_of": NOT_DUP})
        for spec in args.set or []:
            qid, topic, note = parse_set(spec)
            if qid not in by_id:
                sys.exit(f"{qid}: tags.csv にない（先に tag を実行する）")
            if topic != "-" and topic not in topics:
                sys.exit(f"{topic}: 論点マスタ（src/content/topics.ts）にない論点ID")
            by_id[qid].update({"topic": topic, "by": "manual", **({"note": note} if note else {})})
        write_tags(tags_path, rows)
        print(f"{len(args.set or [])}件を手で設定し、{len(args.not_dup or [])}件を重複ではないとした → {tags_path}")
        return

    all_qs: list[dict] = []
    for d in extracted_dirs(Path(args.out), args.dir):
        meta, qs = load_questions(d)
        for q in qs:
            q["scope"] = meta.get("scope", "current")
        all_qs += [q for q in qs if taggable(q)]
    dups = find_duplicates(all_qs)

    if args.eval:
        manual = {r["id"]: r["topic"] for r in rows if r["by"] == "manual"}
        hit = sure = sure_hit = n = 0
        for q in all_qs:
            if q["id"] not in manual or manual[q["id"]] == "-":
                continue
            s = suggest(q["prompt"], q["choices"])
            n += 1
            hit += s.topic == manual[q["id"]]
            sure += s.sure
            sure_hit += s.sure and s.topic == manual[q["id"]]
            if s.topic != manual[q["id"]]:
                print(f"{q['id']}\t正:{manual[q['id']]}\t案:{s.topic}{'' if s.sure else '?'}\t{s.ranked[:3]}")
        print(f"手で付けた{n}問のうち、自動の1位が一致 {hit}問 / 確信度あり {sure}問中 {sure_hit}問が一致")
        return

    new = []
    review = []
    for q in all_qs:
        s = suggest(q["prompt"], q["choices"])
        missing = "missing" in q["flags"]
        row = {
            "id": q["id"],
            "book": q["book"],
            "scope": q["scope"],
            "kai": str(q["kai"] or ""),
            "daimon": str(q["daimon"]),
            "sub": str(q["sub"] or ""),
            "no": str(q["no"]),
            "cited": " ".join(q["cited"]),
            "topic": s.topic or "",
            "by": "auto" if s.sure and not missing else "review",
            "dup_of": dups.get(q["id"], ""),
        }
        new.append(row)
        if row["by"] == "review" and not row["dup_of"]:
            review.append((q, s))
    rows = merge_tags(rows, new)
    write_tags(tags_path, rows)

    manual = {r["id"] for r in rows if r["by"] == "manual"}
    pending = [(q, s) for q, s in review if q["id"] not in manual]
    print(f"{len(new)}問に論点を付けた（重複{len(dups)}問）。要確認{len(pending)}問 → {tags_path}")
    for q, s in pending:
        why = "読み落とし" if "missing" in q["flags"] else ("旧範囲?" if s.old_scope else "拮抗")
        cand = " ".join(f"{t}:{v}" for t, v in s.ranked[:3])
        prompt = q["prompt"][: args.width] + ("…" if len(q["prompt"]) > args.width else "")
        print(f"{q['id']} p{q['page']} [{why}] {cand}\t{prompt}\t{'/'.join(q['choices'])}")


STATS_BEGIN = "<!-- stats:begin（prep.py stats --write が生成。手で編集しない） -->"
STATS_END = "<!-- stats:end -->"


def render_stats(rows: list[dict], topics: dict[str, str]) -> str:
    ids = set(topics)
    books = sorted({(r["scope"] != "current", r["book"]) for r in counted(rows, ids)})
    first_book = books[0][1] if books else ""

    def lab(r: dict) -> str:
        prefix = "" if r["book"] == first_book else f"{r['book']}:"
        return f"{prefix}{r['kai']}-{r['no']}"

    def by_kai(r: dict) -> tuple:
        return (r["book"] != first_book, r["book"], int(r["kai"] or 0), int(r["no"] or 0))

    freq = frequency(rows, ids)
    n1 = sum(len(v) for _, v in freq)
    rounds = sorted({(r["book"], r["kai"]) for r in rows if r["daimon"] == "1"})
    pending = sum(1 for r in rows if r["by"] == "review" and not r["dup_of"])
    out = [
        STATS_BEGIN,
        "",
        "### 第1問（仕訳）の出題数",
        "",
        f"{len(rounds)}回分・{n1}問の集計（同じ問題の重複と範囲外を除く{f'。要確認の{pending}問は含まない' if pending else ''}）。"
        + (f" `{first_book}` 以外の本は「書名:回-問」で示す。" if len(books) > 1 else ""),
        "",
        "| 順位 | 論点 | ID | 出題数 | 出題回-設問 |",
        "|---|---|---|---|---|",
    ]
    rank = 0
    prev = None
    for i, (topic, rs) in enumerate(freq, start=1):
        if len(rs) != prev:
            rank, prev = i, len(rs)
        out.append(f"| {rank} | {topics[topic]} | {topic} | {len(rs)} | {', '.join(lab(r) for r in sorted(rs, key=by_kai))} |")
    for topic in topics:
        # アプリで要素ごとに分けた小項目（depreciation-amount など）は、まとめた論点（depreciation）で数える
        sub = any(topic.startswith(f"{p}-") for p in topics)
        if topic not in dict(freq) and topic not in FORMAT_TOPICS and not sub:
            out.append(f"| — | {topics[topic]} | {topic} | 0 | |")

    out += ["", "### 第3問（決算整理事項）の出題回数", "", "| 論点 | ID | 回数 | 出題回 |", "|---|---|---|---|"]
    for topic, ks in rounds_by_topic(rows, ids):
        out.append(f"| {topics[topic]} | {topic} | {len(ks)} | {', '.join(ks)} |")
    out += ["", STATS_END]
    return "\n".join(out)


def cmd_stats(args: argparse.Namespace) -> None:
    """tags.csv から出題数の表を作る。--write で docs/topic-map.md の印の間を置き換える。"""
    text = render_stats(read_tags(Path(args.tags)), load_topics(TOPICS_TS))
    if not args.write:
        print(text)
        return
    doc = TOPIC_MAP.read_text(encoding="utf-8")
    start, end = doc.find(STATS_BEGIN), doc.find(STATS_END)
    if start < 0 or end < 0:
        sys.exit(f"{TOPIC_MAP} に集計を差し込む印がない")
    TOPIC_MAP.write_text(doc[:start] + text + doc[end + len(STATS_END) :], encoding="utf-8")
    print(f"{TOPIC_MAP} を更新した")


def cmd_crop(args: argparse.Namespace) -> None:
    """ページ全体、またはページ内の表の部分を、読みやすい大きさの画像にする。"""
    pdf = Path(args.pdf)
    out = Path(args.out) / pdf.stem / "img"
    out.mkdir(parents=True, exist_ok=True)
    info = subprocess.run(["pdfinfo", "-f", str(args.page), "-l", str(args.page), str(pdf)], capture_output=True, text=True, check=True).stdout
    m = re.search(rf"Page\s+{args.page} size:\s+([\d.]+) x ([\d.]+)", info) or re.search(r"Page size:\s+([\d.]+) x ([\d.]+)", info)
    width, height = float(m.group(1)), float(m.group(2))

    box = [0.0, 0.0, width, height]
    suffix = "page"
    if args.table:
        region = table_region(pdf, args.page, width)
        if region is None:
            print("このページに表は見つからない。ページ全体を出力する", file=sys.stderr)
        else:
            box, suffix = region, "table"
    if args.bbox:
        box, suffix = [float(v) for v in args.bbox.split(",")], "bbox"

    dpi = args.dpi
    scale = dpi / 72
    stem = out / f"p{args.page:03d}-{suffix}"
    cmd = [
        "pdftoppm", "-f", str(args.page), "-l", str(args.page), "-r", str(dpi), "-gray", "-png", "-singlefile",
        "-x", str(int(box[0] * scale)), "-y", str(int(box[1] * scale)),
        "-W", str(int((box[2] - box[0]) * scale)), "-H", str(int((box[3] - box[1]) * scale)),
        str(pdf), str(stem),
    ]  # fmt: skip
    subprocess.run(cmd, check=True)
    print(f"{stem}.png")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def extract_options(e: argparse.ArgumentParser) -> None:
        e.add_argument("--out", default=DEFAULT_OUT)
        e.add_argument("--book")
        e.add_argument("--kai", type=int)
        e.add_argument("--kind", choices=["q", "a"])
        e.add_argument("--scope", choices=["current", "old"], default="current", help="old は2022年度適用より前の範囲の本")
        e.add_argument("--force", action="store_true")

    i = sub.add_parser("ingest", help="アップロードされたPDF（またはフォルダ）を保管し、まとめて抽出する")
    i.add_argument("src", nargs="+")
    extract_options(i)
    i.set_defaults(func=cmd_ingest)

    e = sub.add_parser("extract", help="文字データを抽出・補正し、問題単位に分割する")
    e.add_argument("pdf", nargs="+")
    extract_options(e)
    e.set_defaults(func=cmd_extract)

    st = sub.add_parser("status", help="取り込み済みの本と、タグ付けの進み具合を表で出す")
    st.add_argument("--out", default=DEFAULT_OUT)
    st.add_argument("--tags", default=TAGS)
    st.set_defaults(func=cmd_status)

    t = sub.add_parser("tag", help="論点を自動で付け、要確認の問題だけを表示する")
    t.add_argument("dir", nargs="*", help="省略すると取り込み済みのすべての本")
    t.add_argument("--set", action="append", metavar="ID=論点[:要約]", help="手で論点を付ける（論点を - にすると集計から外す）")
    t.add_argument("--not-dup", action="append", metavar="ID", help="文が似ていて重複と判定されたが、別の問題だと確認したもの（--set と一緒に使う）")
    t.add_argument("--eval", action="store_true", help="手で付けた論点と自動の結果を照合する")
    t.add_argument("--width", type=int, default=80)
    t.add_argument("--out", default=DEFAULT_OUT)
    t.add_argument("--tags", default=TAGS)
    t.set_defaults(func=cmd_tag)

    sa = sub.add_parser("stats", help="tags.csv から出題数を集計する")
    sa.add_argument("--write", action="store_true", help="docs/topic-map.md の集計部分を置き換える")
    sa.add_argument("--tags", default=TAGS)
    sa.set_defaults(func=cmd_stats)

    ls = sub.add_parser("list", help="抽出した問題を1行ずつ表示する")
    ls.add_argument("dir", nargs="+")
    ls.add_argument("--width", type=int, default=120)
    ls.set_defaults(func=cmd_list)

    c = sub.add_parser("crop", help="ページまたは表の部分を画像にする")
    c.add_argument("pdf")
    c.add_argument("--page", type=int, required=True)
    c.add_argument("--table", action="store_true", help="金額が並ぶ範囲だけを切り出す")
    c.add_argument("--bbox", help="x0,y0,x1,y1（pt）で範囲を指定する")
    c.add_argument("--dpi", type=int, default=110)
    c.add_argument("--out", default=DEFAULT_OUT)
    c.set_defaults(func=cmd_crop)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
