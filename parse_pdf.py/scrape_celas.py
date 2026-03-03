import json
import time
from playwright.sync_api import sync_playwright

def scrape_celas_final_v2():
    all_data = []

    # 正確なパス名リスト
    path_names = [
        "liberal-arts", "gakumon-ss", "advanced-seminar",
        "advanced-liberal-arts", "information", "health-sports",
        "language-1st", "language-2nd", "global"
    ]

    target_links = []
    for path in path_names:
        # 春夏
        target_links.append({"url": f"https://www.celas.osaka-u.ac.jp/education/syllabus/spring-summer_{path}/", "term": "春夏"})
        # 秋冬 (autumn-winter)
        target_links.append({"url": f"https://www.celas.osaka-u.ac.jp/education/syllabus/autumn-winter_{path}/", "term": "秋冬"})

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for link in target_links:
            print(f"解析中 ({link['term']}): {link['url']}...")
            try:
                # 存在しないページ（学問への扉の秋冬など）は404になるので、レスポンスを確認
                response = page.goto(link['url'], timeout=30000)
                if response.status == 404:
                    print(f"  -> ページが存在しません。スキップします。")
                    continue

                page.wait_for_selector("tr", timeout=5000)
                rows = page.query_selector_all("tr")

                # 言語系は1単位、その他は2単位
                default_credits = 1 if "language" in link['url'] else 2

                for row in rows:
                    code_th = row.query_selector("th.code a")
                    if code_th:
                        code = code_th.inner_text().strip()
                        subject_td = row.query_selector("td.title")
                        teacher_td = row.query_selector("td.instructor")

                        if subject_td and teacher_td:
                            all_data.append({
                                "category": f"{link['url'].split('_')[-1].replace('/', '')}({link['term']})",
                                "code": code,
                                "name": subject_td.inner_text().strip().replace('\n', ' '),
                                "teacher": teacher_td.inner_text().strip().replace('\n', ' '),
                                "credits": default_credits
                            })
                time.sleep(0.5)
            except Exception as e:
                print(f"  -> 通信エラーまたは要素未発見: {link['url']}")

        browser.close()

    # 重複排除（同じコードが複数ページにある場合、最初の一つを採用）
    unique_data = {v['code']: v for v in all_data}.values()

    with open("celas_subjects.json", "w", encoding="utf-8") as f:
        json.dump(list(unique_data), f, ensure_ascii=False, indent=2)

    print(f"成功！合計 {len(unique_data)} 件の教養データを保存しました。")

if __name__ == "__main__":
    scrape_celas_final_v2()
