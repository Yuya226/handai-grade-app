import { getSupabaseAdmin } from './supabase';
import type { Grade } from './types';

export interface Subject {
    id: number;
    code: string | null;
    name: string;
    category: string | null;
    credits: number | null;
    teacher: string | null;
    semester: string | null;
    source: string;
    year: number | null; // 年度（同一コードが年度ごとに別科目に使われるため必要）
}

/** 6桁数字のみ有効なコードとみなす */
function isValidCode(code: string | null | undefined): code is string {
    return typeof code === 'string' && /^\d{6}$/.test(code.trim());
}

/**
 * OCR で取得した grades を subjects テーブルと照合・補完する。
 *
 * - code のみでルックアップ（年度ミスマッチを防ぐ。category は年度間で同一）
 * - DB にない code → OCR データを INSERT（source='ocr'）
 * - DB にある code → name / credits / category を DB 値で上書き
 */
export async function validateAndEnrichGrades(grades: Grade[]): Promise<Grade[]> {
    const supabase = getSupabaseAdmin();

    // 1. 有効なコードを収集
    const validCodes = [
        ...new Set(grades.map(g => g.courseCode).filter(isValidCode)),
    ];

    // 2. コードで一括 SELECT し、2種類のMapを構築
    //    exactMap: (code-year) → Subject  科目名・単位数の正確な照合に使用
    //    catMap:   code → category        年度ミスマッチ時のcategoryフォールバック
    const exactMap = new Map<string, Subject>();
    const catMap   = new Map<string, string | null>();
    if (validCodes.length > 0) {
        const { data } = await supabase
            .from('subjects')
            .select('id, code, name, category, credits, teacher, semester, source, year')
            .in('code', validCodes);

        for (const row of data ?? []) {
            if (!isValidCode(row.code)) continue;
            exactMap.set(`${row.code}-${row.year ?? 'null'}`, row as Subject);
            if (!catMap.has(row.code)) catMap.set(row.code, row.category);
        }
    }

    /**
     * (code, year) 完全一致 → Subject を返す（名前・単位数・categoryをすべて使用）
     * 年度ミスマッチ → { category のみ } を返す（名前の誤混入を防ぐ）
     */
    function findSubject(grade: Grade): Subject | { categoryOnly: string | null } | undefined {
        if (!isValidCode(grade.courseCode)) return undefined;
        const code = grade.courseCode!;
        const exact = exactMap.get(`${code}-${grade.year}`);
        if (exact) return exact;
        if (catMap.has(code)) return { categoryOnly: catMap.get(code) ?? null };
        return undefined;
    }

    // 3. DB に (code, year) が存在しない場合のみ INSERT（source='ocr'）
    const newRows: Omit<Subject, 'id'>[] = [];
    const seen = new Set<string>();

    for (const grade of grades) {
        if (!isValidCode(grade.courseCode)) continue;
        const key = `${grade.courseCode}-${grade.year}`;
        const found = findSubject(grade);
        if (found && !('categoryOnly' in found)) continue; // exactMapに存在する
        if (seen.has(key)) continue;
        seen.add(key);
        newRows.push({
            code:     grade.courseCode!,
            name:     grade.subject,
            category: null,
            credits:  grade.credits,
            teacher:  grade.teacher !== 'Unknown' ? grade.teacher : null,
            semester: grade.semester || null,
            source:   'ocr',
            year:     grade.year,
        });
    }

    if (newRows.length > 0) {
        await supabase
            .from('subjects')
            .upsert(newRows, { onConflict: 'code,year', ignoreDuplicates: true });
    }

    // デバッグ: OCR解析科目 ↔ DB照合結果を出力
    console.log('\n=== 科目照合結果 ===');
    for (const grade of grades) {
        const found = findSubject(grade);
        const isExact = found && !('categoryOnly' in found);
        console.log({
            ocr_name:    grade.subject,
            ocr_code:    grade.courseCode ?? null,
            ocr_year:    grade.year,
            match:       !found ? 'none' : isExact ? 'exact' : 'category-only',
            db_name:     isExact ? (found as Subject).name : null,
            db_category: found ? (isExact ? (found as Subject).category : (found as { categoryOnly: string | null }).categoryOnly) : null,
        });
    }
    console.log('===================\n');

    // 4. grades を DB 値で補完
    //    完全一致: name / credits / category すべて上書き
    //    categoryのみ一致: category だけ補完（OCR の科目名・単位数を維持）
    return grades.map(grade => {
        const found = findSubject(grade);
        if (!found) return grade;
        if ('categoryOnly' in found) {
            return { ...grade, category: found.categoryOnly ?? grade.category ?? null };
        }
        const subject = found as Subject;
        return {
            ...grade,
            subject:  subject.name,
            credits:  subject.credits ?? grade.credits,
            category: subject.category ?? grade.category ?? null,
        };
    });
}
