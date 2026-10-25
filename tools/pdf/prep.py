#!/usr/bin/env python3
"""参考書のsearchable PDFから、Claudeが少ないトークンで読める中間データを作る。

使い方（出力はすべて references/ 以下。著作物のためコミットしない）:

  python3 tools/pdf/prep.py extract tac-mondai-02-q.pdf      # 文字データの抽出・補正・問題分割
  python3 tools/pdf/prep.py list references/tac-mondai-02-q  # 問題を1行ずつの要約で表示
  python3 tools/pdf/prep.py crop tac-mondai-02-q.pdf --page 8 [--table]  # ページ（の表部分）を画像に

ファイル名は <書名>-<回>-<q|a>.pdf とする。出典（回）はOCRではなくファイル名から取る。
見出しの「第2回」が「第4回」と読まれるなど、OCRの見出しは信用できないため。

外部依存は poppler-utils（pdftotext / pdftoppm / pdfinfo）のみ。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from textfix import line_flags, normalize_line, split_questions  # noqa: E402

DEFAULT_OUT = Path("references")
NS = {"x": "http://www.w3.org/1999/xhtml"}
AMOUNT = re.compile(r"^\d{1,3}(,\d{3})+$")
TABLE_MIN_AMOUNTS = 12  # 金額がこれ以上並ぶページは表とみなす


@dataclass
class SourceMeta:
    book: str
    kai: int | None
    kind: str  # q（問題）| a（解答）| ?

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
        out = Path(args.out) / pdf.stem
        digest = sha256(pdf)
        meta_path = out / "meta.json"
        if meta_path.exists() and not args.force and json.loads(meta_path.read_text(encoding="utf-8"))["sha256"] == digest:
            print(f"{pdf.name}: 抽出済み（--force で再実行）")
            continue
        out.mkdir(parents=True, exist_ok=True)

        meta = SourceMeta.from_filename(pdf)
        if args.book:
            meta.book = args.book
        if args.kai is not None:
            meta.kai = args.kai
        if args.kind:
            meta.kind = args.kind

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

    e = sub.add_parser("extract", help="文字データを抽出・補正し、問題単位に分割する")
    e.add_argument("pdf", nargs="+")
    e.add_argument("--out", default=DEFAULT_OUT)
    e.add_argument("--book")
    e.add_argument("--kai", type=int)
    e.add_argument("--kind", choices=["q", "a"])
    e.add_argument("--force", action="store_true")
    e.set_defaults(func=cmd_extract)

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
