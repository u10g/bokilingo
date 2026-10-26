"""tagging の単体テスト。

入力はすべて自作の短い取引文。参考書の本文は使わない。
実行: python3 -m unittest discover -s tools/pdf
"""

import unittest

from prep import parse_set, render_stats
from tagging import find_duplicates, frequency, merge_tags, rounds_by_topic, suggest


class SuggestTest(unittest.TestCase):
    def test_clear_cases(self):
        cases = [
            ("得意先から返品を受け、掛け代金から差し引いた。", ["売掛金", "売上"], "sales-extra"),
            ("小口現金係から支払いの報告を受け、ただちに小切手で補給した。郵便切手代と文房具代。", ["小口現金", "通信費"], "cash-short"),
            ("給料総額から源泉所得税と社会保険料を差し引き、普通預金から振り込んだ。", ["給料", "所得税預り金"], "payroll"),
            ("前期末に計上した未収利息を、期首に再振替した。", ["未収利息", "受取利息"], "accruals"),
            ("従業員が出張から戻り、旅費の概算払いを精算した。", ["仮払金", "旅費交通費"], "suspense"),
            ("消費税の処理(税抜方式)を行う。", [], "consumption-tax"),
        ]
        for prompt, choices, topic in cases:
            with self.subTest(prompt=prompt):
                s = suggest(prompt, choices)
                self.assertEqual(s.topic, topic)
                self.assertTrue(s.sure)

    def test_close_call_needs_review(self):
        s = suggest("事務所の家賃と電話料金が普通預金口座から引き落とされた。", ["支払家賃", "通信費"])
        self.assertFalse(s.sure)

    def test_no_clue(self):
        s = suggest("", [])
        self.assertIsNone(s.topic)
        self.assertFalse(s.sure)

    def test_old_scope_needs_review(self):
        s = suggest("売買目的で有価証券を購入し、代金は小切手を振り出して支払った。", [])
        self.assertTrue(s.old_scope)
        self.assertFalse(s.sure)


def q(id, daimon=1, no=1, prompt="", cited=(), book="b", kai=1, sub=None):
    return {"id": id, "book": book, "kai": kai, "daimon": daimon, "sub": sub, "no": no, "prompt": prompt, "cited": list(cited)}


class DuplicateTest(unittest.TestCase):
    LONG = "得意先に商品を売り上げ、代金のうち一部は注文時に受け取った手付金と相殺し、残額は掛けとした。"

    def test_same_question_citation(self):
        dup = find_duplicates([q("a", cited=["サンプル問題3-問14"]), q("b", kai=2, prompt="別の文", cited=["サンプル問題3-問14"])])
        self.assertEqual(dup, {"b": "a"})

    def test_similar_text_with_other_amounts(self):
        other = self.LONG.replace("一部", "¥30,000")
        dup = find_duplicates([q("a", prompt=self.LONG), q("b", book="old", prompt=other)])
        self.assertEqual(dup, {"b": "a"})

    def test_boilerplate_in_daimon3_is_not_duplicate(self):
        text = "消費税の処理(税抜方式)を行う。"
        dup = find_duplicates([q("a", daimon=3, no=9, prompt=text, cited=["サンプル問題2"]), q("b", daimon=3, no=9, kai=2, prompt=text, cited=["第147回第5問"])])
        self.assertEqual(dup, {})

    def test_daimon3_same_exam_in_two_books(self):
        dup = find_duplicates([q("a", daimon=3, no=4, cited=["第147回第5問"]), q("b", daimon=3, no=4, book="old", cited=["第147回第5問"])])
        self.assertEqual(dup, {"b": "a"})


def row(id, topic, by="auto", daimon="1", no="1", kai="1", book="b", dup_of="", scope="current"):
    return {"id": id, "book": book, "scope": scope, "kai": kai, "daimon": daimon, "sub": "", "no": no, "cited": "", "topic": topic, "by": by, "dup_of": dup_of, "note": ""}


class TagTableTest(unittest.TestCase):
    def test_manual_is_kept(self):
        old = [row("a", "loans", by="manual")]
        merged = merge_tags(old, [row("a", "expenses", dup_of="x")])
        self.assertEqual((merged[0]["topic"], merged[0]["by"], merged[0]["dup_of"]), ("loans", "manual", "x"))

    def test_auto_is_updated(self):
        merged = merge_tags([row("a", "loans")], [row("a", "expenses")])
        self.assertEqual(merged[0]["topic"], "expenses")

    def test_counting_rules(self):
        topics = {"loans", "notes"}
        rows = [
            row("a", "loans", no="1"),
            row("b", "loans", no="2", kai="2"),
            row("c", "loans", no="3", dup_of="a"),  # 重複
            row("d", "notes", no="4", by="review"),  # 要確認
            row("e", "-", no="5", by="manual"),  # 範囲外
        ]
        rows[3]["topic"] = "notes"
        freq = dict(frequency(rows, topics))
        self.assertEqual([r["id"] for r in freq["loans"]], ["a", "b"])
        self.assertNotIn("notes", freq)

    def test_rounds_count_once_per_round(self):
        rows = [row("a", "accruals", daimon="3", no="8"), row("b", "accruals", daimon="3", no="9"), row("c", "accruals", daimon="3", no="8", kai="2")]
        self.assertEqual(rounds_by_topic(rows, {"accruals"}), [("accruals", ["1", "2"])])

    def test_render(self):
        text = render_stats([row("a", "loans"), row("b", "loans", book="old", scope="old")], {"loans": "貸し借り", "notes": "手形"})
        self.assertIn("| 1 | 貸し借り | loans | 2 | 1-1, old:1-1 |", text)
        self.assertIn("| — | 手形 | notes | 0 | |", text)

    def test_parse_set(self):
        self.assertEqual(parse_set("b-01-1-7=notes:電子記録債権の発生"), ("b-01-1-7", "notes", "電子記録債権の発生"))
        self.assertEqual(parse_set("b-01-1-7=-"), ("b-01-1-7", "-", ""))


if __name__ == "__main__":
    unittest.main()
