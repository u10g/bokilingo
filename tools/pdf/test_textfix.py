"""textfix の単体テスト。

入力はすべて、OCRの誤りの傾向をまねて自作した文。参考書の本文は使わない。
実行: python3 -m unittest discover -s tools/pdf
"""

import unittest

from textfix import daimon_number, leading_marker, line_flags, match_question_no, normalize_line, parse_choices, split_questions


class NormalizeTest(unittest.TestCase):
    def test_yen(self):
        self.assertEqual(normalize_line("手数料早3,000を支払った"), "手数料¥3,000を支払った")
        self.assertEqual(normalize_line("早く支払った"), "早く支払った")

    def test_zero_and_thousands(self):
        self.assertEqual(normalize_line("合計 48,00〇"), "合計 48,000")
        self.assertEqual(normalize_line("1.250,000"), "1,250,000")
        # 設問番号＋日付は金額ではないので変えない
        self.assertEqual(normalize_line("2.4月1日"), "2.4月1日")


class ChoicesTest(unittest.TestCase):
    def test_confused_markers(self):
        got = parse_choices("ァ・現金イ.普通預金ウ・売掛金工.買掛金オ.仕入力・売上")
        self.assertEqual([c for _, c in got], ["現金", "普通預金", "売掛金", "買掛金", "仕入", "売上"])
        self.assertEqual([m for m, _ in got], list("アイウエオカ"))

    def test_missing_separator(self):
        got = parse_choices("ア.現金 イ.備品 ウ.未払金 エ.土地 オ仮払金 カ通信費")
        self.assertEqual([c for _, c in got], ["現金", "備品", "未払金", "土地", "仮払金", "通信費"])

    def test_single_item_line(self):
        self.assertEqual(parse_choices("エ.電子記録債務", "エ"), [("エ", "電子記録債務")])

    def test_not_choices(self):
        self.assertIsNone(parse_choices("アルバイトに給料を支払った。"))
        self.assertIsNone(parse_choices("ア.この説明文は科目名にしては長すぎるので選択肢ではない"))

    def test_leading_marker(self):
        self.assertEqual(leading_marker("力.雑費"), "カ")
        self.assertEqual(leading_marker("札・資本金"), "オ")
        self.assertIsNone(leading_marker("カード代金を支払った"))


class HeadingTest(unittest.TestCase):
    def test_daimon(self):
        self.assertEqual(daimon_number("第 1問 45点"), 1)
        self.assertEqual(daimon_number("第答I問れるものを選び"), 1)
        self.assertEqual(daimon_number("2問紙の勘定に記入しなさい"), 2)

    def test_citation_is_not_heading(self):
        self.assertIsNone(daimon_number("(第150回第3問)"))


class QuestionNoTest(unittest.TestCase):
    def test_variants(self):
        self.assertEqual(match_question_no("3.備品を購入した。", 3)[0], 3)
        self.assertEqual(match_question_no("13,現金を引き出した。", 13)[0], 13)
        self.assertEqual(match_question_no('9"決算日における', 9)[0], 9)
        self.assertEqual(match_question_no("4.敷金が返金された。", 14)[0], 14)  # 先頭の1が欠けた
        self.assertEqual(match_question_no("〇.出張から戻り", 10)[0], 10)
        self.assertEqual(match_question_no("8.掛代金を回収した。", 7)[0], 8)  # 7を読み落とした

    def test_rejects(self):
        self.assertIsNone(match_question_no("1,250,000", 1))
        self.assertIsNone(match_question_no("9月30日に支払った。", 9))
        self.assertIsNone(match_question_no("5.前の設問の番号", 9))


class FlagsTest(unittest.TestCase):
    def test_unit(self):
        self.assertIn("unit", line_flags("土地3208を1T当たり¥10,000で購入した"))

    def test_noisy(self):
        self.assertIn("noisy", line_flags("取引の内容:?;に囂"))
        self.assertEqual(line_flags("備品を購入した。"), [])


class SplitTest(unittest.TestCase):
    PAGES = [
        [
            "第1問",
            "次の取引について仕訳しなさい。",
            "1.4月1日に備品¥80,000を購入し、代金は月末に支払うこととした。",
            "ア.備品イ・未払金ウ.買掛金",
            "2.得意先から売掛金¥1.250,000を小切手で回収した。",
            "ァ・現金",
            "イ.売掛金",
            "3.出張旅費の概算額¥30,000を現金で渡した。",
            "力.仮払金",  # 読み順が前後して、カがアより先に来る
            "ア.現金",
        ],
        [
            "⑴丸山商店の取引にもとづき、勘定に記入しなさい。",
            "2問",
            "ア.前期繰越イ.次期繰越",
            "(第150回第2問)",
            "(2)次の資料から空欄を埋めなさい。",
            "(サンプル問題4)",
            "第",
            "3問決算整理事項にもとづき精算表を作成しなさい。",
            "1.現金過不足は雑損とする。",
            "2消費税の処理を行う。",
            "3.9月30日に購入した備品を減価償却する。",
            "(第151回第3問)",
            "第1問",  # ここから解答
            "1.(イ) 80,000",
        ],
    ]

    def setUp(self):
        self.qs = split_questions(self.PAGES)
        self.by_key = {(q.daimon, q.sub, q.no): q for q in self.qs}

    def test_question_units(self):
        keys = [(q.daimon, q.sub, q.no) for q in self.qs]
        self.assertEqual(
            keys,
            [(1, None, None), (1, None, 1), (1, None, 2), (1, None, 3), (2, 1, None), (2, 2, None), (3, None, None), (3, None, 1), (3, None, 2), (3, None, 3)],
        )

    def test_choices_and_amounts(self):
        self.assertEqual([c for _, c in self.by_key[(1, None, 1)].choices], ["備品", "未払金", "買掛金"])
        q2 = self.by_key[(1, None, 2)]
        self.assertIn("¥1,250,000", q2.prompt)
        self.assertEqual([c for _, c in q2.choices], ["現金", "売掛金"])
        self.assertEqual([m for m, _ in self.by_key[(1, None, 3)].choices], ["ア", "カ"])

    def test_date_is_not_question_number(self):
        self.assertIn("9月30日", self.by_key[(3, None, 3)].prompt)

    def test_citations_spread_within_daimon(self):
        self.assertEqual(self.by_key[(2, 1, None)].cited, ["第150回第2問"])
        self.assertEqual(self.by_key[(2, 2, None)].cited, ["サンプル問題4"])
        self.assertEqual(self.by_key[(3, None, 1)].cited, ["第151回第3問"])
        self.assertEqual(self.by_key[(1, None, 1)].cited, [])

    def test_missing_question_is_kept(self):
        qs = split_questions([["第1問", "1.備品を購入した。", "3.土地を売却した。", "第2問"]])
        self.assertEqual([(q.no, sorted(q.flags)) for q in qs if q.no], [(1, []), (2, ["missing"]), (3, [])])

    def test_inline_question_is_recovered(self):
        qs = split_questions([["第3問", "1.現金過不足は雑損とする。", "2.貸倒引当金を設定する。表の文字。3.当座借越に振り替える。", "4.減価償却を行う。", "第4問"]])
        by_no = {q.no: q for q in qs if q.no}
        self.assertEqual(by_no[3].prompt, "当座借越に振り替える。")
        self.assertEqual(by_no[3].flags, {"recovered"})
        self.assertEqual(by_no[2].prompt, "貸倒引当金を設定する。表の文字。")

    def test_first_daimon_inferred(self):
        # 第1問の見出しが読めず、第2問の見出しは読めた
        qs = split_questions([["1.備品を購入した。", "2.土地を売却した。", "第2問", "(1)勘定に記入しなさい。"]])
        self.assertEqual([(q.daimon, q.no) for q in qs if q.no], [(1, 1), (1, 2)])

    def test_garbled_first_heading(self):
        self.assertEqual(daimon_number("第［問"), 1)

    def test_citation_with_question_number(self):
        qs = split_questions([["第1問", "1.備品を購入した。", "2.土地を売却した。(サンプル問題3一問14)", "3.現金を引き出した。", "第2問"]])
        self.assertEqual([q.cited for q in qs if q.no], [[], ["サンプル問題3-問14"], []])

    def test_stops_at_answers(self):
        self.assertFalse(any("(イ)" in q.prompt for q in self.qs))


if __name__ == "__main__":
    unittest.main()


class SplitLinesTest(unittest.TestCase):
    def test_heading_digit_on_next_line(self):
        qs = split_questions([["第 問", "1", "45点", "1", ",備品を購入した。", "2", ",土地を売却した。", "第2問"]])
        q1 = [q for q in qs if q.daimon == 1 and q.no]
        self.assertEqual([(q.no, q.prompt) for q in q1], [(1, ",備品を購入した。".lstrip(",")), (2, "土地を売却した。")])

    def test_garbled_heading_next_to_dai(self):
        qs = split_questions([["第1問", "1.備品を購入した。"], ["N問", "第", "(1)勘定に記入しなさい。"], ["3問", "1.減価償却を行う。"]])
        self.assertEqual(sorted({q.daimon for q in qs}), [1, 2, 3])
        self.assertEqual([q.daimon for q in qs if q.sub == 1], [2])

    def test_daimon1_has_at_most_15(self):
        lines = ["第1問"] + [f"{i}.取引{i}。" for i in range(1, 16)] + ["16.請求書の数字", "第2問"]
        qs = split_questions([lines])
        self.assertEqual(max(q.no or 0 for q in qs if q.daimon == 1), 15)

    def test_unread_headings_of_daimon2_and_3(self):
        first = ["第1問"] + [f"{i}.取引{i}。" for i in range(1, 16)]
        second = ["(1)次の資料にもとづいて勘定に記入しなさい。", "1.4月1日の取引。", "(2)次の文の空欄を埋めなさい。", "1.用語の問。"]
        third = ["ゴミ", "次の(1)決算整理前残高試算表および(2)決算整理事項等にもとづいて、貸借対照表を完成しなさい。", "1.期末商品棚卸高は¥1,000である。", "2.消費税の処理を行う。"]
        qs = split_questions([first, second, third])
        self.assertEqual(max(q.no or 0 for q in qs if q.daimon == 1), 15)
        self.assertEqual(sorted({q.sub for q in qs if q.daimon == 2} - {None}), [1, 2])
        self.assertEqual([q.no for q in qs if q.daimon == 3 and q.no], [1, 2])

    def test_circled_numbers_in_daimon3(self):
        qs = split_questions([["第3問", "次の決算整理事項等にもとづいて答えなさい。", "①", "売掛金の入金が未記帳である。", "'②仮払金を精算する。", "③", "④", "。期末商品棚卸高は¥1,000である。"]])
        self.assertEqual([(q.no, q.prompt) for q in qs if q.daimon == 3 and q.no and q.prompt][:2], [(1, "売掛金の入金が未記帳である。"), (2, "仮払金を精算する。")])
        self.assertIn(4, [q.no for q in qs if q.daimon == 3])

