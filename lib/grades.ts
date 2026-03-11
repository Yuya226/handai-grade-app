import type { Grade } from './types';

/**
 * CSV（KOAN エクスポート）向け評語正規化。
 * 全角文字を NFKC で正規化し、合 → P に変換する。
 */
export function normalizeGradeCSV(raw: string): Grade['grade'] {
    const normalized = raw.normalize('NFKC').toUpperCase().trim();
    if (normalized === '合') return 'P';
    if (['S', 'A', 'B', 'C', 'F', 'P'].includes(normalized)) {
        return normalized as Grade['grade'];
    }
    return null;
}

/**
 * OCR（Google Vision）向け評語正規化。
 * OCR由来の結合トークン（例: "B合"）や数字/文字誤認（8→B 等）を補正する。
 */
export function normalizeGradeOCR(rawGrade: string): Grade['grade'] | null {
    // OCRで隣接セルがマージされたトークンを処理: "B合" → "B"
    const merged = /^([SABCFPsabcfp])合/.exec(rawGrade);
    if (merged) return merged[1].toUpperCase() as Grade['grade'];

    let g = rawGrade.trim().toUpperCase();
    // OCR 数字/文字誤認補正
    if (g === '8') g = 'B';
    if (g === '6') g = 'S';
    if (g === '5') g = 'S';
    if (g === '0') g = 'C';
    if (g === '4') g = 'A';

    if (['S', 'A', 'B', 'C', 'F', 'P'].includes(g)) return g as Grade['grade'];
    return null;
}
