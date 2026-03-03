import { Grade } from './types';

// ─── Internal Types ───────────────────────────────────────────────────────────
interface Word {
    text: string;
    x: number;
    y: number;
    width: number;
}

interface ParsedLine {
    words: Word[];
    avgY: number;
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────
const CREDIT_MAP: Record<string, number> = {
    '00': 2, '01': 2, '02': 2, '03': 2, '04': 2,
    '05': 2, '0A': 2, '06': 2, '07': 2, '08': 2,
    '09': 2, '10': 2, '13': 2, '19': 1,
};

function inferCredits(courseCode: string): number {
    return CREDIT_MAP[courseCode.substring(0, 2)] ?? 2;
}

function inferSemester(lineStr: string): string {
    if (/前学期|前期|春学期|春〜夏/.test(lineStr)) return '前期';
    if (/後学期|後期|秋学期|秋〜冬/.test(lineStr)) return '後期';
    if (/通年/.test(lineStr)) return '通年';
    return '前期';
}

function normalizeGrade(raw: string): Grade['grade'] | null {
    let g = raw.toUpperCase();
    if (g === '8') g = 'B';
    if (g === '6' || g === '5') g = 'S';
    if (g === '0') g = 'C';
    if (['S', 'A', 'B', 'C', 'F'].includes(g)) return g as Grade['grade'];
    if (raw.includes('合')) return 'P';
    return null;
}

function reconstructLines(annotations: any[]): ParsedLine[] {
    const words: Word[] = annotations.slice(1).flatMap((a) => {
        const v: { x: number; y: number }[] = a.boundingPoly?.vertices ?? [];
        if (v.length < 4) return [];
        return [{
            text: a.description as string,
            y: (v[0].y + v[2].y) / 2,
            x: v[0].x,
            width: v[1].x - v[0].x,
        }];
    });

    words.sort((a, b) => a.y - b.y);

    const lines: ParsedLine[] = [];
    const TOLERANCE = 15;

    for (const word of words) {
        const matched = lines.find((l) => Math.abs(l.avgY - word.y) < TOLERANCE);
        if (matched) {
            matched.words.push(word);
            matched.avgY =
                (matched.avgY * (matched.words.length - 1) + word.y) /
                matched.words.length;
        } else {
            lines.push({ words: [word], avgY: word.y });
        }
    }

    lines.sort((a, b) => a.avgY - b.avgY);
    lines.forEach((l) => l.words.sort((a, b) => a.x - b.x));
    return lines;
}

// ─── Format Detection ─────────────────────────────────────────────────────────
type Format = 'pc' | 'mobile';

function detectFormat(lines: ParsedLine[]): Format {
    const fullText = lines.flatMap((l) => l.words.map((w) => w.text)).join(' ');
    if (/春学期|春〜夏学期|修得年度[：:]/.test(fullText)) return 'mobile';
    return 'pc';
}

// ─── PC Format Parser (unchanged logic from app/api/analyze/route.ts) ─────────
function parsePCFormat(lines: ParsedLine[]): Grade[] {
    const grades: Grade[] = [];
    const COLUMN_GAP_THRESHOLD = 15;

    for (const line of lines) {
        const lineStr = line.words.map((w) => w.text).join(' ');
        const codeMatch = lineStr.match(/(?:^|\D)(\d{6})(?:\D|$)/);
        const yearMatch = lineStr.match(/202[0-9]/);

        if (codeMatch && yearMatch) {
            const code = codeMatch[1];
            const year = parseInt(yearMatch[0]);

            const codeWord = line.words.find((w) => w.text.includes(code));
            const yearWord = line.words.find((w) => w.text.includes(year.toString()));
            const codeEndX = codeWord ? codeWord.x + codeWord.width : 0;
            const yearStartX = yearWord ? yearWord.x : 9999;

            let finalGrade: Grade['grade'] | null = null;
            for (let i = line.words.length - 1; i >= 0; i--) {
                const w = line.words[i];
                if (w.x < yearStartX) continue;
                if (w.text.length > 2 && !w.text.includes('合')) continue;
                const g = normalizeGrade(w.text);
                if (g) {
                    if (!finalGrade) {
                        finalGrade = g;
                    } else if (finalGrade === 'P' && g !== 'P') {
                        finalGrade = g;
                    }
                }
            }

            const credits = inferCredits(code);
            const contentWords = line.words.filter((w) => {
                const center = w.x + w.width / 2;
                return center > codeEndX && center < yearStartX;
            });
            contentWords.sort((a, b) => a.x - b.x);

            let subject = 'Unknown Subject';
            let teacher = '';

            if (contentWords.length > 0) {
                const BRACKET_START = /^[（(「【＜<]/;
                const gapList: { gap: number; index: number }[] = [];
                for (let i = 0; i < contentWords.length - 1; i++) {
                    const cur = contentWords[i];
                    const nxt = contentWords[i + 1];
                    gapList.push({ gap: nxt.x - (cur.x + cur.width), index: i });
                }
                gapList.sort((a, b) => b.gap - a.gap);

                let splitIndex = -1;
                for (const { gap, index } of gapList) {
                    if (gap <= COLUMN_GAP_THRESHOLD) break;
                    if (!BRACKET_START.test(contentWords[index + 1].text)) {
                        splitIndex = index;
                        break;
                    }
                }

                if (splitIndex >= 0) {
                    subject = contentWords
                        .slice(0, splitIndex + 1)
                        .map((w) => w.text)
                        .join(' ');
                    teacher = contentWords
                        .slice(splitIndex + 1)
                        .map((w) => w.text)
                        .join(' ');
                } else {
                    subject = contentWords.map((w) => w.text).join(' ');
                    teacher = '';
                }
            }

            const cleanText = (s: string) =>
                s
                    .replace(/\|/g, '')
                    .replace(/\s+([（）＜＞「」【】<>(){}])/g, '$1')
                    .replace(/([（＜「【<({])\s+/g, '$1')
                    .replace(/\s+/g, ' ')
                    .trim();

            subject = cleanText(subject).replace(/^[0-9]+\s*/, '');
            teacher = cleanText(teacher);
            if (subject.length === 0) subject = 'Unknown Subject';
            if (teacher.length === 0) teacher = 'Unknown';

            if (finalGrade) {
                grades.push({
                    subject,
                    teacher,
                    semester: inferSemester(lineStr),
                    credits,
                    grade: finalGrade,
                    year,
                    courseCode: code,
                });
            }
        }
    }

    return grades;
}

// ─── Mobile Format Parser ─────────────────────────────────────────────────────

/** Split a card header line into subject and teacher by largest X-gap. */
function splitSubjectTeacher(headerLine: ParsedLine): { subject: string; teacher: string } {
    const words = [...headerLine.words].sort((a, b) => a.x - b.x);
    const BRACKET_START = /^[（(「【＜<]/;
    const COLUMN_GAP_THRESHOLD = 15;

    const gapList: { gap: number; index: number }[] = [];
    for (let i = 0; i < words.length - 1; i++) {
        const cur = words[i];
        const nxt = words[i + 1];
        gapList.push({ gap: nxt.x - (cur.x + cur.width), index: i });
    }
    gapList.sort((a, b) => b.gap - a.gap);

    let splitIndex = -1;
    for (const { gap, index } of gapList) {
        if (gap <= COLUMN_GAP_THRESHOLD) break;
        if (!BRACKET_START.test(words[index + 1].text)) {
            splitIndex = index;
            break;
        }
    }

    const cleanText = (s: string) =>
        s
            .replace(/\|/g, '')
            .replace(/\s+([（）＜＞「」【】<>(){}])/g, '$1')
            .replace(/([（＜「【<({])\s+/g, '$1')
            .replace(/\s+/g, ' ')
            .trim();

    if (splitIndex >= 0) {
        return {
            subject: cleanText(words.slice(0, splitIndex + 1).map((w) => w.text).join(' ')),
            teacher: cleanText(words.slice(splitIndex + 1).map((w) => w.text).join(' ')),
        };
    }
    return {
        subject: cleanText(words.map((w) => w.text).join(' ')),
        teacher: 'Unknown',
    };
}

/**
 * Parse mobile (card-style) KOAN grade screenshot.
 *
 * Card structure per course:
 *   Line i-1 : {科目名}   {教員名}          ← large X-gap separates the two
 *   Line i   : {年度} {学期} {コード}   {評語}  ← anchor; grade is in right column
 *   Line i+1 : リーディング：                  ← skip
 *   Line i+2 : 高度教養:                       ← skip
 *   Line i+3 : 修得年度: {年度}                ← skip
 */
function parseMobileFormat(lines: ParsedLine[]): Grade[] {
    const grades: Grade[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineStr = line.words.map((w) => w.text).join(' ');

        // ── Anchor detection: contains year (202x) + semester keyword + 6-digit code ──
        const yearMatch = lineStr.match(/(20\d{2})/);
        const codeMatch = lineStr.match(/(\d{6})/);
        if (!yearMatch || !codeMatch) continue;
        if (!/学期|学年/.test(lineStr)) continue;

        const year = parseInt(yearMatch[1]);
        const courseCode = codeMatch[1];
        const credits = inferCredits(courseCode);
        const semester = inferSemester(lineStr);

        // ── Locate right boundary of anchor content (end of course code word) ──
        const codeWord = line.words.find((w) => w.text === courseCode);
        let anchorRightX: number;
        if (codeWord) {
            anchorRightX = codeWord.x + codeWord.width;
        } else {
            // Fallback: use rightmost word that looks like part of the anchor
            const anchorCandidates = line.words.filter(
                (w) => /20\d{2}/.test(w.text) || /学期|学年/.test(w.text) || /\d{6}/.test(w.text)
            );
            anchorRightX =
                anchorCandidates.length > 0
                    ? Math.max(...anchorCandidates.map((w) => w.x + w.width))
                    : 0;
        }

        // ── Extract grade from right column (words to the right of anchor content) ──
        // Search right-to-left; prefer letter grade over '合' (pass button)
        const rightWords = line.words
            .filter((w) => w.x > anchorRightX + 10)
            .sort((a, b) => b.x - a.x);

        let finalGrade: Grade['grade'] | null = null;
        for (const w of rightWords) {
            if (w.text.length > 2 && !w.text.includes('合')) continue;
            const g = normalizeGrade(w.text);
            if (g) {
                if (!finalGrade) {
                    finalGrade = g;
                } else if (finalGrade === 'P' && g !== 'P') {
                    // Prefer letter grade (S/A/B/C/F) over P
                    finalGrade = g;
                }
            }
        }

        // ── Subject and teacher come from the line immediately above the anchor ──
        let subject = 'Unknown Subject';
        let teacher = 'Unknown';
        if (i > 0) {
            const { subject: s, teacher: t } = splitSubjectTeacher(lines[i - 1]);
            if (s) subject = s;
            teacher = t;
        }

        if (finalGrade) {
            grades.push({ subject, teacher, semester, credits, grade: finalGrade, year, courseCode });
        }
    }

    return grades;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function parseVisionResponse(annotations: any[]): Grade[] {
    const lines = reconstructLines(annotations);
    const format = detectFormat(lines);
    return format === 'mobile' ? parseMobileFormat(lines) : parsePCFormat(lines);
}
