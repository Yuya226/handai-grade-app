/**
 * Supabase subjects テーブルへのインポートスクリプト
 * Usage: npm run import-subjects
 *
 * 2024・2025・2026 年度の CELAS・econ 科目データを一括インポートする。
 *
 * category の保存形式:
 *   CELAS → スラグ（例: "liberal-arts", "gakumon-ss"）
 *   econ  → スラグ（例: "econ-sel1", "econ-basic"）
 *   ※ requirements.ts の CATEGORY_TO_REQ と対応させるためスラグで統一する
 *
 * conflict キー: (code, year)
 *   CELAS: code あり全件 → onConflict: 'code,year'
 *   econ : code あり     → onConflict: 'code,year'
 *          code なし     → (name, year) で重複確認してから insert
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^"|"$/g, '');
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(/^"|"$/g, '');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const DATA_DIR = path.resolve(__dirname, '../../シラバスデータ/parse_pdf.py');
const YEARS = [2024, 2025, 2026] as const;
type Year = typeof YEARS[number];

// ── 共通ユーティリティ ──────────────────────────────────────────────────────────

/** 6桁数字のみ有効コードとする */
function toValidCode(raw: string | null | undefined): string | null {
    const s = (raw ?? '').trim();
    return /^\d{6}$/.test(s) ? s : null;
}

interface SubjectRow {
    code: string | null;
    name: string;
    category: string | null;
    credits: number | null;
    teacher: string | null;
    semester: string | null;
    source: string;
    year: number | null;
}

// ── CELAS ──────────────────────────────────────────────────────────────────────

/**
 * 2024年以前のCELASは英語スラグ形式（例: "health-sports(春夏)"）、
 * 2025年以降は日本語形式（例: "健康・スポーツ教育科目"）。
 * どちらも日本語に統一してDBに保存する。
 */
const SLUG_TO_JP: Record<string, string> = {
    'gakumon-ss':            '学問への扉',
    'liberal-arts':          '基盤教養教育科目',
    'advanced-liberal-arts': '高度教養教育科目',
    'advanced-seminar':      'アドヴァンスト・セミナー',
    'information':           '情報教育科目',
    'health-sports':         '健康・スポーツ教育科目',
    'global':                'グローバル理解教育科目',
    'language-1st':          'マルチリンガル教育科目（英語）',
    'language-2nd':          'マルチリンガル教育科目（第2外国語）',
};

function celasCategory(raw: string, name: string): string | null {
    // 季節サフィックスを除去して正規化
    const cat = raw.replace(/\((春夏|秋冬)\)\s*$/, '').trim();

    // 旧英語スラグ形式（2024以前）→ 日本語に変換
    if (SLUG_TO_JP[cat]) return SLUG_TO_JP[cat];

    // 新日本語形式（2025以降）: マルチリンガルのみ名前で英語/第2外国語を判定
    if (cat === 'マルチリンガル教育科目') {
        return /総合英語|実践英語/.test(name)
            ? 'マルチリンガル教育科目（英語）'
            : 'マルチリンガル教育科目（第2外国語）';
    }

    return cat || null;
}

function loadCelas(year: Year): SubjectRow[] {
    const filePath = path.join(DATA_DIR, `celas_subjects_${year}.json`);
    const raw: Array<{
        category: string; code: string; name: string;
        teacher: string; credits: number; year?: number;
    }> = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    return raw
        .filter(item => item.name?.trim())
        .map(item => {
            const cleanName = item.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            return {
                code:     toValidCode(item.code),
                name:     cleanName,
                category: celasCategory(item.category ?? '', cleanName),
                credits:  typeof item.credits === 'number' ? item.credits : null,
                teacher:  item.teacher?.replace(/\n/g, ' ').trim() || null,
                semester: null,
                source:   'celas',
                year:     item.year ?? year,
            };
        })
        .filter(r => r.name.length > 0);
}

// ── econ ───────────────────────────────────────────────────────────────────────


function cleanEconName(raw: string): string {
    return raw
        .replace(/【[^】]*】/g, '')
        .replace(/（別掲[^）]*）/g, '')
        .replace(/＜別掲[^＞]*＞/g, '')
        .trim();
}

function cleanEconCategory(raw: string): string {
    return raw
        .replace(/\n|\r/g, '')
        .replace(/（別掲[^）]*）/g, '')
        .replace(/＜別掲[^＞]*＞/g, '')
        .trim();
}

function loadEcon(year: Year): SubjectRow[] {
    const filePath = path.join(DATA_DIR, `econ_subjects_${year}.json`);
    const raw: Array<{
        category: string; code: string; name: string;
        credits: string; teacher: string; semester: string;
    }> = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    return raw
        .filter(item => !!cleanEconName(item.name ?? ''))
        .map(item => {
            const name = cleanEconName(item.name);
            const creditsNum = parseInt(item.credits ?? '', 10);
            const cleanedCat = cleanEconCategory(item.category ?? '');
            const row: SubjectRow = {
                code:     toValidCode(item.code),
                name,
                category: cleanedCat || null,
                credits:  isNaN(creditsNum) ? null : creditsNum,
                teacher:  item.teacher?.trim() || null,
                semester: item.semester?.trim() || null,
                source:   'econ',
                year,
            };
            return row;
        });
}

// ── バッチ処理 ──────────────────────────────────────────────────────────────────

/**
 * code あり → (code, year) を conflict キーに upsert
 * code なし → (name, year) で重複確認してから insert
 */
async function importRows(rows: SubjectRow[], label: string): Promise<void> {
    const withCode    = rows.filter(r => r.code !== null);
    const withoutCode = rows.filter(r => r.code === null);

    // code あり: 500 件ずつ upsert
    const BATCH = 500;
    for (let i = 0; i < withCode.length; i += BATCH) {
        const batch = withCode.slice(i, i + BATCH);
        const { error } = await supabase
            .from('subjects')
            .upsert(batch, { onConflict: 'code,year' });
        if (error) { console.error(`[${label}] upsert error:`, error.message); throw error; }
        console.log(`  [${label}] upsert ${i + 1}–${Math.min(i + BATCH, withCode.length)} / ${withCode.length}`);
    }

    // code なし: (name, year) で重複確認 → 新規のみ insert
    for (const row of withoutCode) {
        const { data: existing } = await supabase
            .from('subjects')
            .select('id')
            .eq('name', row.name)
            .eq('year', row.year as number)
            .maybeSingle();
        if (existing) continue;
        const { error } = await supabase.from('subjects').insert(row);
        if (error) console.warn(`  [${label}] insert skipped (${row.name}):`, error.message);
    }
    if (withoutCode.length > 0) {
        console.log(`  [${label}] code-null entries: ${withoutCode.length}`);
    }
}

// ── メイン ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('Clearing existing subjects (source=celas/econ)...');
    await supabase.from('subjects').delete().in('source', ['celas', 'econ']);

    let totalCelas = 0;
    let totalEcon = 0;

    for (const year of YEARS) {
        console.log(`\n=== ${year}年度 ===`);

        const celasRows = loadCelas(year);
        const econRows  = loadEcon(year);

        console.log(`  celas: ${celasRows.length} 件（コードあり: ${celasRows.filter(r => r.code).length}）`);
        console.log(`  econ : ${econRows.length} 件（コードあり: ${econRows.filter(r => r.code).length} / コードなし: ${econRows.filter(r => !r.code).length}）`);

        await importRows(celasRows, `celas-${year}`);
        await importRows(econRows,  `econ-${year}`);

        totalCelas += celasRows.length;
        totalEcon  += econRows.length;
    }

    const { count } = await supabase
        .from('subjects')
        .select('*', { count: 'exact', head: true });

    console.log('\n=== 完了 ===');
    console.log(`  celas 合計: ${totalCelas} 件`);
    console.log(`  econ  合計: ${totalEcon} 件`);
    console.log(`  subjects テーブル合計: ${count} 件`);
}

main().catch(err => { console.error(err); process.exit(1); });
