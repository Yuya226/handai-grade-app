import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export interface GradeDist {
    S: number; A: number; B: number; C: number; F: number;
}

export interface CourseResult {
    id: number;
    code: string | null;
    name: string;
    category: string | null;
    credits: number | null;
    teacher: string | null;
    semester: string | null;
    source: string;
    year: number | null;
    gradeDist: GradeDist | null;
    totalCount: number | null;
}

export interface CoursesResponse {
    results: CourseResult[];
    total: number;
    yearCounts: Record<number, number>;
}

const MIN_COUNT = 1;

/** (course_code, year) をキーに成績分布を集計する。course_code がない場合は subject_name にフォールバック */
function buildDistMap(
    rows: { subject_name: string | null; course_code?: string | null; year?: number | null; grade: string | null; session_id?: string }[]
): Map<string, GradeDist & { total: number }> {
    const seen = new Set<string>();
    const map = new Map<string, GradeDist & { total: number }>();
    for (const row of rows) {
        if (!row.grade) continue;
        if (!['S', 'A', 'B', 'C', 'F'].includes(row.grade)) continue;
        const key = row.course_code
            ? `${row.course_code}-${row.year ?? ''}`
            : row.subject_name;
        if (!key) continue;
        if (row.session_id) {
            const dedup = `${row.session_id}:${key}`;
            if (seen.has(dedup)) continue;
            seen.add(dedup);
        }
        const entry = map.get(key) ?? { S: 0, A: 0, B: 0, C: 0, F: 0, total: 0 };
        entry[row.grade as keyof GradeDist]++;
        entry.total++;
        map.set(key, entry);
    }
    return map;
}

function toGradeDist(d: GradeDist & { total: number }): GradeDist {
    return {
        S: Math.round(d.S / d.total * 100) / 100,
        A: Math.round(d.A / d.total * 100) / 100,
        B: Math.round(d.B / d.total * 100) / 100,
        C: Math.round(d.C / d.total * 100) / 100,
        F: Math.round(d.F / d.total * 100) / 100,
    };
}

function attachDist(subjects: any[], distMap: Map<string, GradeDist & { total: number }>): CourseResult[] {
    return subjects.map(s => {
        const d = (s.code ? distMap.get(`${s.code}-${s.year ?? ''}`) : null) ?? distMap.get(s.name);
        const hasData = d && d.total >= MIN_COUNT;
        return {
            ...s,
            gradeDist: hasData ? toGradeDist(d!) : null,
            totalCount: hasData ? d!.total : null,
        };
    });
}

/** subjects の code と name の両方で grade_submissions をフェッチしてマージ */
async function fetchGradeRowsForSubjects(
    supabase: ReturnType<typeof import('@/lib/supabase').getSupabaseAdmin>,
    subjects: { code: string | null; name: string }[]
) {
    const codes = [...new Set(subjects.map(s => s.code).filter((c): c is string => !!c))];
    const names = [...new Set(subjects.map(s => s.name))];
    const queries: Promise<{ data: any[] | null }>[] = [];
    if (codes.length > 0) {
        queries.push(
            supabase.from('grade_submissions')
                .select('subject_name, course_code, year, grade, session_id')
                .in('course_code', codes) as any
        );
    }
    if (names.length > 0) {
        queries.push(
            supabase.from('grade_submissions')
                .select('subject_name, course_code, year, grade, session_id')
                .in('subject_name', names) as any
        );
    }
    const results = await Promise.all(queries);
    return results.flatMap(r => r.data ?? []);
}

function saRate(s: any, distMap: Map<string, GradeDist & { total: number }>): number {
    const d = (s.code ? distMap.get(`${s.code}-${s.year ?? ''}`) : null) ?? distMap.get(s.name);
    return d && d.total > 0 ? (d.S + d.A) / d.total : -1;
}

function applySort(subjects: any[], sort: string, distMap: Map<string, GradeDist & { total: number }>): any[] {
    return [...subjects].sort((a, b) => {
        if (sort === 'year_desc') return (b.year ?? 0) - (a.year ?? 0);
        if (sort === 'year_asc')  return (a.year ?? 0) - (b.year ?? 0);
        return saRate(b, distMap) - saRate(a, distMap);
    });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100);
    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0'));
    const offset = page * limit;
    const yearParam = searchParams.get('year');
    const yearFilter = yearParam ? parseInt(yearParam) : null;
    const sort = searchParams.get('sort') ?? 'sa_rate';

    const supabase = getSupabaseAdmin();
    let allSubjects: any[];
    let distMap: Map<string, GradeDist & { total: number }>;

    if (q) {
        // ── 検索: subjects から引いて成績を付与 ──────────────────────────────
        const isCodeQuery = /^\d+$/.test(q);
        let sq = supabase
            .from('subjects')
            .select('id, code, name, category, credits, teacher, semester, source, year');
        sq = isCodeQuery ? sq.ilike('code', `${q}%`) : sq.ilike('name', `%${q}%`);
        const { data } = await sq;
        allSubjects = data ?? [];
        distMap = buildDistMap(await fetchGradeRowsForSubjects(supabase, allSubjects));
    } else {
        // ── デフォルト: grade_submissions から引いて成績データのある科目のみ ──
        const { data: gradeRows } = await supabase
            .from('grade_submissions')
            .select('subject_name, course_code, year, grade, session_id');
        distMap = buildDistMap(gradeRows ?? []);
        if (distMap.size === 0) return NextResponse.json({ results: [], total: 0, yearCounts: {} });

        const hasDataSet = new Set(
            [...distMap.entries()]
                .filter(([, d]) => d.total >= MIN_COUNT)
                .map(([key]) => key)
        );
        const codes = [...new Set((gradeRows ?? []).map(r => r.course_code).filter((c): c is string => !!c))];
        const { data } = await supabase
            .from('subjects')
            .select('id, code, name, category, credits, teacher, semester, source, year')
            .in('code', codes);
        allSubjects = (data ?? []).filter(s => hasDataSet.has(`${s.code}-${s.year ?? ''}`));
    }

    if (!allSubjects.length) return NextResponse.json({ results: [], total: 0, yearCounts: {} });

    // ── 共通: 年度カウント → 年度フィルター → ソート → ページネーション ──────
    const yearCounts: Record<number, number> = {};
    for (const s of allSubjects) {
        if (s.year) yearCounts[s.year] = (yearCounts[s.year] ?? 0) + 1;
    }

    const filtered = yearFilter ? allSubjects.filter(s => s.year === yearFilter) : allSubjects;
    const sorted = applySort(filtered, sort, distMap);
    const total = sorted.length;
    const page_results = sorted.slice(offset, offset + limit);

    return NextResponse.json({ results: attachDist(page_results, distMap), total, yearCounts });
}
