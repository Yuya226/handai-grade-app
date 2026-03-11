import { NextRequest, NextResponse } from 'next/server';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';

type IEntityAnnotation = protos.google.cloud.vision.v1.IEntityAnnotation;

// Initialize Google Cloud Vision Client
const client = new ImageAnnotatorClient({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/"/g, ''),
        project_id: process.env.GOOGLE_PROJECT_ID,
    },
});

interface ParsedLine {
    words: { text: string, x: number, y: number, width: number }[];
    avgY: number;
}

// Define the structure for our Grade Data - Imported from lib/types
import { Grade, AnalysisResult } from '@/lib/types';
import { calculateGPA } from '@/lib/gpa';
import { validateAndEnrichGrades } from '@/lib/subjects';
import { inferCredits } from '@/lib/credits';
import { normalizeGradeOCR } from '@/lib/grades';
import { TOTAL_REQUIRED_CREDITS } from '@/lib/requirements';

function inferSemester(lineStr: string): string {
    if (/前学期|前期|春学期|春〜夏学期/.test(lineStr)) return '前期';
    if (/後学期|後期|秋学期|秋〜冬学期/.test(lineStr)) return '後期';
    if (/通年/.test(lineStr)) return '通年';
    return '前期';
}


function reconstructLinesFromAnnotations(annotations: IEntityAnnotation[]): ParsedLine[] {
    // Skip index 0 (full text)
    const words = annotations.slice(1).map(a => {
        const vertices = a.boundingPoly?.vertices || [];
        if (vertices.length < 4) return null;

        return {
            text: a.description ?? '',
            // Calculate mid-Y for grouping
            y: ((vertices[0].y ?? 0) + (vertices[2].y ?? 0)) / 2,
            // X for sorting and column detection
            x: vertices[0].x ?? 0,
            width: (vertices[1].x ?? 0) - (vertices[0].x ?? 0),
        };
    }).filter(w => w !== null) as { text: string, x: number, y: number, width: number }[];

    // Sort by Y primarily
    words.sort((a, b) => a.y - b.y);

    const lines: ParsedLine[] = [];
    // 8px に絞ることで、縮小スクショ（80%以下）での行マージを防ぐ
    const LINE_HEIGHT_TOLERANCE = 8;

    for (const word of words) {
        let matchedLine = lines.find(line => Math.abs(line.avgY - word.y) < LINE_HEIGHT_TOLERANCE);

        if (matchedLine) {
            matchedLine.words.push(word);
            // weighted avg update
            matchedLine.avgY = (matchedLine.avgY * (matchedLine.words.length - 1) + word.y) / matchedLine.words.length;
        } else {
            lines.push({ words: [word], avgY: word.y });
        }
    }

    // Sort lines by Y
    lines.sort((a, b) => a.avgY - b.avgY);

    // Within each line, sort words left to right
    lines.forEach(line => {
        line.words.sort((a, b) => a.x - b.x);
    });

    return lines;
}

/**
 * Y座標の分布が二峰性の行（複数行がマージされた行）を分割する。
 * LINE_HEIGHT_TOLERANCE を下げても残るマージを後処理でケアする。
 */
function splitMixedLines(lines: ParsedLine[]): ParsedLine[] {
    const result: ParsedLine[] = [];
    for (const line of lines) {
        if (line.words.length < 4) { result.push(line); continue; }

        const ys = [...line.words.map(w => w.y)].sort((a, b) => a - b);
        const gaps = ys.slice(1).map((y, i) => y - ys[i]);
        const maxGap = Math.max(...gaps);

        // 8px を超えるY方向のギャップがあれば2行に分割
        if (maxGap > 8) {
            const threshold = ys[gaps.indexOf(maxGap)] + maxGap / 2;
            const topWords    = line.words.filter(w => w.y <= threshold);
            const bottomWords = line.words.filter(w => w.y >  threshold);
            if (topWords.length > 0 && bottomWords.length > 0) {
                result.push({
                    words:  topWords.sort((a, b) => a.x - b.x),
                    avgY:   topWords.reduce((s, w) => s + w.y, 0) / topWords.length,
                });
                result.push({
                    words:  bottomWords.sort((a, b) => a.x - b.x),
                    avgY:   bottomWords.reduce((s, w) => s + w.y, 0) / bottomWords.length,
                });
                continue;
            }
        }
        result.push(line);
    }
    return result;
}

// Mobile: info-sub-line patterns that appear below the anchor (not subject/teacher)
const INFO_LINE_RE = /^(リーディング|高度教養|修得年度)/;

// Coordinate-based Parser — supports both PC and mobile KOAN layouts
function parseOCRText(annotations: IEntityAnnotation[]): Grade[] {
    let lines = reconstructLinesFromAnnotations(annotations);
    lines = splitMixedLines(lines);
    const grades: Grade[] = [];

    // Raw annotation words for mobile right-column grade lookup
    const rawWords = annotations.slice(1).map((a) => {
        const verts = a.boundingPoly?.vertices ?? [];
        if (verts.length < 4) return null;
        return {
            text: a.description ?? '',
            y: ((verts[0].y ?? 0) + (verts[2].y ?? 0)) / 2,
            x: verts[0].x ?? 0,
            width: (verts[1].x ?? 0) - (verts[0].x ?? 0),
        };
    }).filter(Boolean) as { text: string; x: number; y: number; width: number }[];

    const COLUMN_GAP_THRESHOLD = 15;

    // ── grade helpers ───────────────────────────────────────────────────────

    /** PC: scan line right→left; primary skips 合/否, fallback maps 合→P */
    function extractGradePC(line: ParsedLine, yearStartX: number): Grade['grade'] | null {
        for (let i = line.words.length - 1; i >= 0; i--) {
            const w = line.words[i];
            if (w.x < yearStartX) continue;
            if (w.text === '合' || w.text === '否') continue;
            if (w.text.length > 2 && !/^[SABCFPsabcfp]合/.test(w.text)) continue;
            const g = normalizeGradeOCR(w.text);
            if (g) return g;
        }
        for (let i = line.words.length - 1; i >= 0; i--) {
            const w = line.words[i];
            if (w.x < yearStartX) continue;
            if (w.text.includes('合')) return 'P';
        }
        return null;
    }

    /** Mobile: find grade in right column (x > infoRightX) within ±70px of anchorY */
    function extractGradeMobile(anchorY: number, infoRightX: number): Grade['grade'] | null {
        const candidates = rawWords.filter(
            w => w.x > infoRightX && Math.abs(w.y - anchorY) < 70
        );
        // Primary: letter grade
        for (const w of candidates) {
            if (w.text === '合' || w.text === '否') continue;
            if (w.text.length > 2 && !/^[SABCFPsabcfp]合/.test(w.text)) continue;
            const g = normalizeGradeOCR(w.text);
            if (g) return g;
        }
        // Fallback: 合 → P (P/F課 shows 合 in grade column; button also shows 合)
        if (candidates.some(w => w.text === '合')) return 'P';
        return null;
    }

    // ── subject/teacher split helper ────────────────────────────────────────

    function extractSubjectTeacher(
        words: { text: string; x: number; y: number; width: number }[]
    ) {
        if (words.length === 0) return { subject: 'Unknown Subject', teacher: 'Unknown' };

        const BRACKET_START = /^[（(「【＜<]/;
        const gapList: { gap: number; index: number }[] = [];
        for (let i = 0; i < words.length - 1; i++) {
            const cur = words[i], nxt = words[i + 1];
            if (Math.abs(cur.y - nxt.y) > 10) continue; // skip cross-line gaps
            gapList.push({ gap: nxt.x - (cur.x + cur.width), index: i });
        }
        gapList.sort((a, b) => b.gap - a.gap);

        let splitIndex = -1;
        for (const { gap, index } of gapList) {
            if (gap <= COLUMN_GAP_THRESHOLD) break;
            if (!BRACKET_START.test(words[index + 1].text)) { splitIndex = index; break; }
        }

        const clean = (s: string) => s
            .replace(/\|/g, '')
            .replace(/\s+([（）＜＞「」【】<>(){}])/g, '$1')
            .replace(/([（＜「【<({])\s+/g, '$1')
            .replace(/\s+/g, ' ')
            .trim();

        let subject: string, teacher: string;
        if (splitIndex >= 0) {
            subject = clean(words.slice(0, splitIndex + 1).map(w => w.text).join(' '));
            teacher = clean(words.slice(splitIndex + 1).map(w => w.text).join(' '));
        } else {
            subject = clean(words.map(w => w.text).join(' '));
            teacher = '';
        }
        subject = subject.replace(/^[0-9]+\s*/, '');
        return { subject: subject || 'Unknown Subject', teacher: teacher || 'Unknown' };
    }

    // ── identify anchor lines (lines containing 6-digit code + 202x year) ──

    const anchorIndices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        const s = lines[i].words.map(w => w.text).join(' ');
        if (/(?:^|\D)\d{6}(?:\D|$)/.test(s) && /202[0-9]/.test(s)) {
            anchorIndices.push(i);
        }
    }
    if (anchorIndices.length === 0) return grades;

    // ── detect mobile (year precedes code) vs PC (code precedes year) ───────

    let isMobile = false;
    {
        const al = lines[anchorIndices[0]];
        const s  = al.words.map(w => w.text).join(' ');
        const cm = s.match(/(?:^|\D)(\d{6})(?:\D|$)/);
        const ym = s.match(/202[0-9]/);
        if (cm && ym) {
            const cw = al.words.find(w => w.text.includes(cm[1]));
            const yw = al.words.find(w => w.text.includes(ym[0]));
            if (cw && yw) isMobile = yw.x < cw.x;
        }
    }

    // ── parse ────────────────────────────────────────────────────────────────

    if (isMobile) {
        // Mobile: subject is on lines ABOVE the anchor; grade is in right column
        for (let ai = 0; ai < anchorIndices.length; ai++) {
            const lineIdx = anchorIndices[ai];
            const line    = lines[lineIdx];
            const lineStr = line.words.map(w => w.text).join(' ');

            const cm = lineStr.match(/(?:^|\D)(\d{6})(?:\D|$)/);
            const ym = lineStr.match(/202[0-9]/);
            if (!cm || !ym) continue;

            const code     = cm[1];
            const year     = parseInt(ym[0]);
            const credits  = inferCredits(code);
            const semester = inferSemester(lineStr);

            // Rightmost X of anchor line = right boundary of info block
            const infoRightX = Math.max(...line.words.map(w => w.x + w.width));
            const grade      = extractGradeMobile(line.avgY, infoRightX);

            // Collect subject words from lines between previous anchor and this anchor
            // (excludes info-sub-lines like リーディング/高度教養/修得年度)
            const prevAnchorIdx = ai > 0 ? anchorIndices[ai - 1] : -1;
            const subjectWords: typeof rawWords = [];
            for (let j = prevAnchorIdx + 1; j < lineIdx; j++) {
                const l    = lines[j];
                const lStr = l.words.map(w => w.text).join(' ');
                if (INFO_LINE_RE.test(lStr)) continue;
                if (line.avgY - l.avgY > 150) continue; // skip page headers far above
                for (const w of l.words) {
                    if (w.x < infoRightX) subjectWords.push(w);
                }
            }
            subjectWords.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

            const { subject, teacher } = extractSubjectTeacher(subjectWords);
            grades.push({ subject, teacher, semester, credits, grade, year, courseCode: code });
        }
    } else {
        // PC: subject, teacher, grade are all on the same line as the code+year anchor
        for (const line of lines) {
            const lineStr = line.words.map(w => w.text).join(' ');

            const cm = lineStr.match(/(?:^|\D)(\d{6})(?:\D|$)/);
            const ym = lineStr.match(/202[0-9]/);
            if (!cm || !ym) continue;

            const code = cm[1];
            const year = parseInt(ym[0]);
            const cw   = line.words.find(w => w.text.includes(code));
            const yw   = line.words.find(w => w.text.includes(year.toString()));
            const codeEndX   = cw ? cw.x + cw.width : 0;
            const yearStartX = yw ? yw.x : 9999;

            const credits = inferCredits(code);
            const grade   = extractGradePC(line, yearStartX);

            const contentWords = line.words
                .filter(w => { const cx = w.x + w.width / 2; return cx > codeEndX && cx < yearStartX; })
                .sort((a, b) => a.x - b.x);

            const { subject, teacher } = extractSubjectTeacher(contentWords);
            grades.push({ subject, teacher, semester: inferSemester(lineStr), credits, grade, year, courseCode: code });
        }
    }

    return grades;
}


export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof Blob)) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        let parsedGrades: Grade[] = [];

        // --- IMAGE OCR PARSING ROUTE ---
        const [result] = await client.textDetection(buffer);
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            return NextResponse.json({ error: 'No text detected in image' }, { status: 400 });
        }

        parsedGrades = parseOCRText(detections);

        // subjects テーブルと照合・補完（科目名・単位数の正規化）
        parsedGrades = await validateAndEnrichGrades(parsedGrades);

        const { cumulative, semesters, earnedCredits } = calculateGPA(parsedGrades);

        const response: AnalysisResult = {
            grades: parsedGrades,
            gpa: {
                cumulative,
                semesters,
            },
            earnedCredits: earnedCredits,
            graduationRequirement: {
                total: TOTAL_REQUIRED_CREDITS,
                current: earnedCredits,
                percentage: Math.round((earnedCredits / TOTAL_REQUIRED_CREDITS) * 100),
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error processing upload:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
