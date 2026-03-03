#!/usr/bin/env python3
"""
celas_subjects.json 用クリーンアップスクリプト
- category の英語名を日本語に変換
- category 末尾の (春夏)/(秋冬) を削除
- name の余分な改行・スペースを削除
"""

import json
import re

# 英語カテゴリ名 -> 日本語
CATEGORY_MAP = {
    "liberal-arts": "基盤教養教育科目",
    "gakumon-ss": "学問への扉",
    "advanced-seminar": "アドヴァンスト・セミナー",
    "advanced-liberal-arts": "高度教養教育科目",
    "information": "情報教育科目",
    "health-sports": "健康・スポーツ教育科目",
    "language-1st": "マルチリンガル教育科目",
    "language-2nd": "マルチリンガル教育科目",
    "global": "グローバル理解教育科目",
}


def clean_category(raw: str) -> str:
    """(春夏)/(秋冬) を削除し、英語名を日本語に変換"""
    s = raw.strip()
    s = re.sub(r"\((春夏|秋冬)\)\s*$", "", s).strip()
    return CATEGORY_MAP.get(s, s)


def clean_name(raw: str) -> str:
    """余分な改行・スペースを削除"""
    if not isinstance(raw, str):
        return raw
    s = raw.replace("\n", " ").replace("\r", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def main():
    path = "celas_subjects.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for item in data:
        if "category" in item:
            item["category"] = clean_category(item["category"])
        if "name" in item:
            item["name"] = clean_name(item["name"])

    out_path = "celas_subjects.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Cleaned {len(data)} items -> {out_path}")


if __name__ == "__main__":
    main()
