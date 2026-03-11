// コースコード先頭2文字 → 単位数マッピング
// 専門科目は2単位または4単位だが、シラバスDBなしでは判別不可のため2単位デフォルト
// 19（言語文化等）のみ1単位が確定
export const CREDIT_MAP: Record<string, number> = {
    '00': 2, // 文学部
    '01': 2, // 人間科学部
    '02': 2, // 法学部
    '03': 2, // 経済学部
    '04': 2, // 理学部
    '05': 2, // 医学部（医）
    '0A': 2, // 医学部（保健）
    '06': 2, // 歯学部
    '07': 2, // 薬学部
    '08': 2, // 工学部
    '09': 2, // 基礎工学部
    '10': 2, // 外国語学部
    '13': 2, // 全学教育推進機構（共通教育）
    '19': 1, // 全学教育推進機構（言語文化等）→ 1単位確定
};

export function inferCredits(courseCode: string): number {
    const prefix = courseCode.substring(0, 2);
    return CREDIT_MAP[prefix] ?? 2;
}
