#!/usr/bin/env python3
"""
econ_subjects.json 用クリーンアップスクリプト
- name フィールドの末尾にある 【新、2025～のみ】や【旧】などの括弧書きを削除
- name フィールド内の（別掲１）や＜別掲２＞などの注釈を削除
- category フィールド内の改行コード \n を削除
- name の前後のスペースを削除
"""

import json
import re


def clean_name(raw: str) -> str:
    """name フィールドをクリーンアップ"""
    if not isinstance(raw, str):
        return raw
    
    s = raw.strip()
    
    # 【...】形式の注釈を削除（末尾だけでなく、どこにあっても）
    s = re.sub(r"【[^】]*】", "", s)
    
    # （別掲...）形式の注釈を削除
    s = re.sub(r"（別掲[^）]*）", "", s)
    
    # ＜別掲...＞形式の注釈を削除
    s = re.sub(r"＜別掲[^＞]*＞", "", s)
    
    # 前後のスペースを削除
    s = s.strip()
    
    return s


def clean_category(raw: str) -> str:
    """category フィールドの改行コードと注釈を削除"""
    if not isinstance(raw, str):
        return raw
    
    s = raw.replace("\n", "").replace("\r", "")
    
    # （別掲...）形式の注釈を削除
    s = re.sub(r"（別掲[^）]*）", "", s)
    
    # ＜別掲...＞形式の注釈を削除
    s = re.sub(r"＜別掲[^＞]*＞", "", s)
    
    s = s.strip()
    
    return s


def main():
    path = "econ_subjects.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for item in data:
        if "name" in item:
            item["name"] = clean_name(item["name"])
        if "category" in item:
            item["category"] = clean_category(item["category"])

    out_path = "econ_subjects.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Cleaned {len(data)} items -> {out_path}")


if __name__ == "__main__":
    main()
