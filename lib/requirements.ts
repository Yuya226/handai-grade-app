import type { Grade } from './types';

// ===== カテゴリ定義 =====

export interface GradCategory {
    id: string;
    label: string;
    group: 'A' | 'B' | 'C' | 'D';
    groupLabel: string;
    minCredits: number;
    note?: string;
    /** 自動判定が困難で手動確認が必要なカテゴリ */
    manualCheck?: boolean;
}

/**
 * 大阪大学 経済学部 2025年度以降入学者 卒業要件
 * 総卒業必要単位数: 130単位
 * 出典: 令和7(2025)年度経済学部学生便覧
 */
export const ECON_2025: GradCategory[] = [
    // A. 教養教育系科目（計 18単位）
    {
        id: 'gateway',
        group: 'A', groupLabel: '教養教育系',
        label: '学問への扉',
        minCredits: 2,
    },
    {
        id: 'lib_req',
        group: 'A', groupLabel: '教養教育系',
        label: '基盤教養（必修）',
        minCredits: 4,
        note: 'ミクロ経済学の考え方・マクロ経済学の考え方',
    },
    {
        id: 'lib_elec',
        group: 'A', groupLabel: '教養教育系',
        label: '基盤教養（選択必修）',
        minCredits: 6,
    },
    {
        id: 'info',
        group: 'A', groupLabel: '教養教育系',
        label: '情報教育',
        minCredits: 2,
        note: '情報社会基礎',
    },
    {
        id: 'sports',
        group: 'A', groupLabel: '教養教育系',
        label: '健康・スポーツ教育',
        minCredits: 2,
        note: 'スマート・スポーツリテラシー or スマート・ヘルスリテラシー',
    },
    {
        id: 'adv_lib',
        group: 'A', groupLabel: '教養教育系',
        label: '高度教養',
        minCredits: 2,
        manualCheck: true,
        note: '2年次秋以降に他学部科目等から取得',
    },

    // B. 国際性涵養教育系科目（計 18単位）
    {
        id: 'english',
        group: 'B', groupLabel: '国際性涵養系',
        label: '英語（第1外国語）',
        minCredits: 8,
        note: '総合英語6単位＋実践英語2単位',
    },
    {
        id: 'lang2',
        group: 'B', groupLabel: '国際性涵養系',
        label: '第2外国語',
        minCredits: 4,
        note: '独・仏・露・中から1言語（初級Ⅰ・Ⅱ・中級）',
    },
    {
        id: 'global',
        group: 'B', groupLabel: '国際性涵養系',
        label: 'グローバル理解',
        minCredits: 4,
        note: '第2外国語と同一言語のグローバル理解科目',
    },
    {
        id: 'adv_intl',
        group: 'B', groupLabel: '国際性涵養系',
        label: '高度国際性涵養',
        minCredits: 2,
        manualCheck: true,
        note: '2年次秋以降の選択必修Ⅱ等（○印）で充足可',
    },

    // C. 専門教育系科目（計 72単位）
    {
        id: 'spec_basic',
        group: 'C', groupLabel: '専門教育系',
        label: '専門基礎教育',
        minCredits: 4,
        note: '解析学入門・線形代数学入門（各2単位）',
    },
    {
        id: 'spec_req',
        group: 'C', groupLabel: '専門教育系',
        label: '専門必修',
        minCredits: 6,
        note: '専門セミナー（2単位）・研究セミナー（4単位）',
    },
    {
        id: 'sel1',
        group: 'C', groupLabel: '専門教育系',
        label: '選択必修Ⅰ',
        minCredits: 12,
        note: 'マクロ/ミクロ経済・経済史・経営計算システム・統計から12単位以上',
    },
    {
        id: 'sel2',
        group: 'C', groupLabel: '専門教育系',
        label: '選択必修Ⅱ',
        minCredits: 28,
        note: '財政・金融・国際経済・計量経済等から28単位以上',
    },
    {
        id: 'spec_elec',
        group: 'C', groupLabel: '専門教育系',
        label: '選択科目',
        minCredits: 22,
        note: '選択必修Ⅰ・Ⅱの超過分を自動算入',
    },

    // D. 自由選択科目（計 22単位）
    {
        id: 'jiyu_elec',
        group: 'D', groupLabel: '自由選択',
        label: '自由選択科目',
        minCredits: 22,
        note: '各カテゴリの超過単位が自動充当されます',
    },
];

// ===== 分類ロジック =====

/**
 * subjects テーブルの category 値（日本語）→ 要件カテゴリ ID のマッピング。
 *
 * 基盤教養教育科目 のみ必修/選択必修が混在するため classifyEcon 内で科目名判定。
 * マルチリンガル教育科目 は import 時にコード先頭2桁で英語/第2外国語に分割済み。
 */
const CATEGORY_TO_REQ: Record<string, string> = {
    // CELAS 共通教育科目
    '学問への扉':                       'gateway',
    '高度教養教育科目':                 'adv_lib',
    'アドヴァンスト・セミナー':         'adv_lib',
    '情報教育科目':                     'info',
    '健康・スポーツ教育科目':           'sports',
    'マルチリンガル教育科目（英語）':   'english',
    'マルチリンガル教育科目（第2外国語）': 'lang2',
    'グローバル理解教育科目':           'global',
    '専門基礎教育科目':                 'spec_basic', // CELAS（解析学入門・線形代数学入門）
    // 経済学部専門科目
    '専門基礎必修':                     'spec_basic',
    '必修科目':                         'spec_req',
    '選択必修１':                       'sel1',
    '選択必修２':                       'sel2',
    '選択科目':                         'spec_elec',
    '選択科目（実践講義）':             'spec_elec',
};

/**
 * 1科目のGradeを要件カテゴリIDに分類する。
 *
 * subjects テーブルの category フィールドをそのまま使用。
 * "liberal-arts" のみ必修/選択必修が同一カテゴリに混在するため科目名で再判定。
 * category が null の場合は null を返す（呼び出し元で未分類として扱う）。
 */
export function classifyEcon(grade: Grade): string | null {
    const cat = grade.category ?? null;
    if (!cat) return null;

    if (cat === '基盤教養教育科目') {
        return /ミクロ経済学の考え方|マクロ経済学の考え方/.test(grade.subject)
            ? 'lib_req'
            : 'lib_elec';
    }

    return CATEGORY_TO_REQ[cat] ?? null;
}

/** Grade を一意に識別するキー */
export function gradeKey(grade: Grade): string {
    return `${grade.courseCode ?? grade.subject}-${grade.year}`;
}

// ===== 進捗計算 =====

export interface CategoryProgress {
    category: GradCategory;
    /** 修得済み単位数（Fを除く） */
    earned: number;
    /** 修得済み科目リスト */
    courses: Grade[];
    /** minCredits を充足しているか（manualCheck は常に false） */
    fulfilled: boolean;
}

export interface GraduationProgress {
    totalRequired: number; // 130
    totalEarned: number;
    byCategory: CategoryProgress[];
    /** DB カテゴリが null でユーザー未分類の科目 */
    unclassified: Grade[];
}

/**
 * @param overrides gradeKey → categoryId のユーザー手動分類マップ
 */
export function calcEconProgress(
    grades: Grade[],
    overrides: Record<string, string> = {},
): GraduationProgress {
    const passed = grades.filter(g => g.grade !== 'F' && g.grade !== null);

    // バケット初期化
    const buckets: Record<string, Grade[]> = {};
    for (const cat of ECON_2025) buckets[cat.id] = [];
    const unclassified: Grade[] = [];

    for (const g of passed) {
        const key = gradeKey(g);
        const id = overrides[key] ?? classifyEcon(g);
        if (id === null) {
            unclassified.push(g);
        } else if (buckets[id] !== undefined) {
            buckets[id].push(g);
        } else {
            unclassified.push(g);
        }
    }

    const byCategory: CategoryProgress[] = ECON_2025.map(cat => {
        const courses = buckets[cat.id] ?? [];
        const earned = courses.reduce((sum, g) => sum + g.credits, 0);
        return {
            category: cat,
            earned,
            courses,
            fulfilled: cat.manualCheck ? false : earned >= cat.minCredits,
        };
    });

    // ── 選択科目（spec_elec）: sel1・sel2 超過分を移行し、移行元を上限に丸める ──
    const sel1Cat  = byCategory.find(c => c.category.id === 'sel1')!;
    const sel2Cat  = byCategory.find(c => c.category.id === 'sel2')!;
    const elecCat  = byCategory.find(c => c.category.id === 'spec_elec')!;
    const sel1Overflow = Math.max(0, sel1Cat.earned - 12);
    const sel2Overflow = Math.max(0, sel2Cat.earned - 28);
    sel1Cat.earned = Math.min(sel1Cat.earned, 12);   // 移行済み分を消す
    sel2Cat.earned = Math.min(sel2Cat.earned, 28);   // 移行済み分を消す
    elecCat.earned += sel1Overflow + sel2Overflow;
    elecCat.fulfilled = elecCat.earned >= 22;

    // ── 自由選択科目（jiyu_elec）: 各カテゴリの超過分を移行し、移行元を上限に丸める ──
    const specElecOverflow = Math.max(0, elecCat.earned - 22);
    elecCat.earned = Math.min(elecCat.earned, 22);   // 移行済み分を消す
    let jiyuEarned = specElecOverflow;
    for (const cp of byCategory) {
        if (cp.category.manualCheck) continue;
        if (['sel1', 'sel2', 'spec_elec', 'jiyu_elec'].includes(cp.category.id)) continue;
        const over = Math.max(0, cp.earned - cp.category.minCredits);
        cp.earned -= over;   // 移行済み分を消す
        jiyuEarned += over;
    }
    const jiyuCat = byCategory.find(c => c.category.id === 'jiyu_elec')!;
    jiyuCat.earned = jiyuEarned;
    jiyuCat.fulfilled = jiyuEarned >= 22;

    const totalEarned = passed.reduce((sum, g) => sum + g.credits, 0);

    return { totalRequired: 130, totalEarned, byCategory, unclassified };
}
