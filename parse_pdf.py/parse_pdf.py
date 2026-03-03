import pdfplumber
import json
import re

PDF_PATH = "2026kaikoukamoku_bc.pdf"

def finalize_syllabus():
    all_data = []
    current_category = "" # 区分を保持しておく変数

    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table: continue

            # Row 0 はヘッダーなので Row 1 から処理
            for row in table[1:]:
                # 1. 区分 (Index 3) が空なら前の行のものを採用
                raw_category = row[3] if row[3] else current_category
                # 改行を消してきれいにする
                clean_category = raw_category.replace('\n', '')
                current_category = clean_category

                # 2. 科目名 (Index 5) の改行も掃除
                subject_name = row[5].replace('\n', '') if row[5] else ""

                # 科目名が空の行（表の末尾など）は飛ばす
                if not subject_name: continue

                # 3. 必要な情報を辞書にまとめる
                item = {
                    "category": clean_category,          # 科目区分（群）
                    "code": row[4].replace('\n', '') if row[4] else "", # 時間割コード
                    "name": subject_name,                # 授業科目名
                    "credits": row[7] if row[7] else "0",# 単位数
                    "teacher": row[8].replace('\n', '') if row[8] else "", # 担当教員
                    "semester": row[9].replace('\n', '') if row[9] else ""  # 開講学期
                }
                all_data.append(item)

    # JSONファイルとして書き出し
    with open("econ_subjects.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"成功！ {len(all_data)} 件の科目を subjects.json に保存しました。")

if __name__ == "__main__":
    finalize_syllabus()
