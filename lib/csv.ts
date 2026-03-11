import type { Grade } from './types';
import { inferCredits } from './credits';
import { normalizeGradeCSV } from './grades';

function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}


/**
 * KOAN からエクスポートした Shift-JIS CSV を Grade[] に変換する。
 *
 * 列構成 (0-indexed):
 *   [5]  時間割コード
 *   [6]  開講科目名
 *   [9]  教員名
 *   [10] 修得年度
 *   [11] 評語（全角: Ａ/Ｓ/Ｂ/Ｃ/Ｆ/合）
 */
export function parseKoanCSV(buffer: ArrayBuffer): Grade[] {
    const text = new TextDecoder('shift-jis').decode(buffer);
    const lines = text.split(/\r?\n/);
    const grades: Grade[] = [];

    // 1行目はヘッダーなのでスキップ
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseCSVLine(line);
        if (fields.length < 12) continue;

        const courseCode = fields[5]?.trim();
        const subject    = fields[6]?.trim();
        const teacher    = fields[9]?.trim() || 'Unknown';
        const yearStr    = fields[10]?.trim();
        const gradeRaw   = fields[11]?.trim();

        if (!courseCode || !/^\d{6}$/.test(courseCode)) continue;
        if (!subject) continue;

        const year = parseInt(yearStr, 10);
        if (!Number.isFinite(year)) continue;

        const grade   = normalizeGradeCSV(gradeRaw ?? '');
        const credits = inferCredits(courseCode);

        grades.push({
            subject,
            teacher,
            semester: null,
            credits,
            grade,
            year,
            courseCode,
        });
    }

    return grades;
}
