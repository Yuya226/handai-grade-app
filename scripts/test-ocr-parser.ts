/**
 * Smoke-test for lib/ocr-parser.ts — mobile format
 * Run: npx tsx scripts/test-ocr-parser.ts
 */
import { parseVisionResponse } from '../lib/ocr-parser';

// ─── Mock annotation builder ──────────────────────────────────────────────────
function word(text: string, x: number, y: number, charW = 14, h = 22) {
    const w = text.length * charW;
    return {
        description: text,
        boundingPoly: {
            vertices: [
                { x, y },
                { x: x + w, y },
                { x: x + w, y: y + h },
                { x, y: y + h },
            ],
        },
    };
}

/**
 * Simulated Google Vision textAnnotations for a 2-course mobile KOAN screenshot.
 *
 * Card layout (y positions are illustrative):
 *
 *  y=100  社会学の考え方           古川岳志
 *  y=130  2024  春〜夏学期  135099               S    合
 *  y=160  リーディング：
 *  y=190  高度教養:
 *  y=220  修得年度: 2024
 *
 *  y=320  法学の考え方             申賢哲
 *  y=350  2024  春〜夏学期  135145               A    合
 *  y=380  リーディング：
 *  y=410  高度教養:
 *  y=440  修得年度: 2024
 */
const annotations = [
    // index 0: full-text block (sliced off by parser)
    { description: 'dummy full text', boundingPoly: { vertices: [] } },

    // ── Course 1 ──────────────────────────────────────────────────────────────
    // Header line (y≈100): subject left, teacher right
    word('社会学の考え方', 20, 100),
    word('古川岳志', 400, 100),

    // Anchor line (y≈130): year, semester, code, grade, pass-button
    word('2024',     20, 130),
    word('春〜夏学期', 80, 130),
    word('135099',  200, 130),
    word('S',       520, 130),   // grade — right column
    word('合',      560, 130),   // pass button — skip

    // Skip lines
    word('リーディング：', 20, 160),
    word('高度教養:',      20, 190),
    word('修得年度:',      20, 220),
    word('2024',          100, 220),

    // ── Course 2 ──────────────────────────────────────────────────────────────
    // Header line (y≈320)
    word('法学の考え方', 20, 320),
    word('申賢哲',       400, 320),

    // Anchor line (y≈350)
    word('2024',     20, 350),
    word('春〜夏学期', 80, 350),
    word('135145',  200, 350),
    word('A',       520, 350),   // grade
    word('合',      560, 350),   // pass button — skip

    // Skip lines
    word('リーディング：', 20, 380),
    word('高度教養:',      20, 410),
    word('修得年度:',      20, 440),
    word('2024',          100, 440),
];

// ─── Run ─────────────────────────────────────────────────────────────────────
const results = parseVisionResponse(annotations);

const EXPECTED = [
    { subject: '社会学の考え方', teacher: '古川岳志', courseCode: '135099', grade: 'S', year: 2024 },
    { subject: '法学の考え方',   teacher: '申賢哲',   courseCode: '135145', grade: 'A', year: 2024 },
];

let passed = 0;
let failed = 0;

console.log('\n=== OCR Parser – Mobile Format Test ===\n');

for (const exp of EXPECTED) {
    const got = results.find((r) => r.courseCode === exp.courseCode);
    const ok =
        got &&
        got.subject  === exp.subject  &&
        got.teacher  === exp.teacher  &&
        got.grade    === exp.grade    &&
        got.year     === exp.year;

    if (ok) {
        console.log(`  PASS  ${exp.courseCode}  ${exp.subject}  →  ${exp.grade}`);
        passed++;
    } else {
        console.log(`  FAIL  ${exp.courseCode}  ${exp.subject}`);
        console.log(`        expected: ${JSON.stringify(exp)}`);
        console.log(`        got:      ${JSON.stringify(got ?? null)}`);
        failed++;
    }
}

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
console.log('Full parse output:');
console.log(JSON.stringify(results, null, 2));

process.exit(failed > 0 ? 1 : 0);
