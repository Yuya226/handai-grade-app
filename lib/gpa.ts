import { Grade } from './types';

export interface SkippedSubject {
    subject: string;
    grade: string;
    credits: number;
    year: number;
    semester: string;
    /** Whether these credits are counted toward earnedCredits despite being GPA-exempt */
    includedInEarnedCredits: boolean;
}

export interface GPAResult {
    cumulative: number;
    semesters: { [key: string]: number };
    earnedCredits: number;
    skippedSubjects: SkippedSubject[];
}

const PASSING_GRADES = new Set(['S', 'A', 'B', 'C']);

/**
 * Known special-grade rules: excluded from GPA, but may count toward earnedCredits.
 * Add entries here as new edge-case symbols are discovered.
 */
const SPECIAL_GRADE_EARNS_CREDITS: Record<string, boolean> = {
    '認定': true,      // Transfer/recognition credit → counts
    '履修放棄': false, // Withdrawal → does not count
};

/** Returns a numeric sort key for chronological ordering of a grade entry. */
function semesterSortKey(year: number, semester: string): number {
    const offset = semester === '前期' ? 0 : semester === '後期' ? 0.5 : 0.25;
    return year + offset;
}

export function calculateGPA(grades: Grade[]): GPAResult {
    // --- 1. Identify superseded F grades (re-enrollment / 再履修) ---
    //
    // Group grades by subject identity. When a subject has at least one
    // passing grade (S/A/B/C), any F grades recorded BEFORE that first
    // passing grade are "superseded" and excluded from cumulative GPA.
    const subjectKey = (g: Grade): string =>
        (g.courseCode?.trim() || g.subject.trim());

    const groupedBySubject = new Map<string, Grade[]>();
    for (const g of grades) {
        const key = subjectKey(g);
        if (!groupedBySubject.has(key)) groupedBySubject.set(key, []);
        groupedBySubject.get(key)!.push(g);
    }

    const supersededFGrades = new Set<Grade>();

    for (const group of groupedBySubject.values()) {
        if (group.length < 2) continue;

        const sorted = [...group].sort(
            (a, b) => semesterSortKey(a.year, a.semester) - semesterSortKey(b.year, b.semester)
        );

        const firstPassIndex = sorted.findIndex(g => PASSING_GRADES.has(g.grade));
        if (firstPassIndex === -1) continue; // No passing grade — nothing to supersede

        // All F entries strictly before the first passing attempt are superseded
        for (let i = 0; i < firstPassIndex; i++) {
            if (sorted[i].grade === 'F') supersededFGrades.add(sorted[i]);
        }
    }

    // --- 2. Accumulate GPA totals ---
    const skippedSubjects: SkippedSubject[] = [];
    let totalPoints = 0;   // cumulative numerator (excl. superseded F)
    let totalCredits = 0;  // cumulative denominator (excl. superseded F)
    let earnedCredits = 0;
    const semesterPoints: { [key: string]: number } = {};
    const semesterCredits: { [key: string]: number } = {};

    for (const g of grades) {
        const credits = g.credits || 0;
        const semKey = `${g.year} ${g.semester}`;

        if (!semesterPoints[semKey]) {
            semesterPoints[semKey] = 0;
            semesterCredits[semKey] = 0;
        }

        let points = 0;
        let inGPA = true;

        // Cast to string so the default branch is reachable at runtime
        // even though Grade.grade is a union type (OCR may return unknown symbols).
        switch (g.grade as string) {
            case 'S': points = 4; break;
            case 'A': points = 3; break;
            case 'B': points = 2; break;
            case 'C': points = 1; break;
            case 'F': points = 0; break;
            case 'P':
                inGPA = false; // Pass (合): excluded from GPA, but counts toward earnedCredits
                break;
            default: {
                // --- 2a. Unknown grade failsafe ---
                inGPA = false;
                const includeInEarned = SPECIAL_GRADE_EARNS_CREDITS[g.grade] ?? false;
                skippedSubjects.push({
                    subject: g.subject,
                    grade: g.grade,
                    credits,
                    year: g.year,
                    semester: g.semester,
                    includedInEarnedCredits: includeInEarned,
                });
                if (includeInEarned) earnedCredits += credits;
                continue; // Skip all further processing for this entry
            }
        }

        // Earned credits: S/A/B/C/P count; F does not
        if (g.grade !== 'F') earnedCredits += credits;

        // Per-semester GPA always reflects the actual semester results,
        // even for F grades that are later superseded by a retake.
        if (inGPA) {
            semesterPoints[semKey] += points * credits;
            semesterCredits[semKey] += credits;
        }

        // Cumulative GPA: exclude superseded F grades (re-enrollment rule)
        if (inGPA && !supersededFGrades.has(g)) {
            totalPoints += points * credits;
            totalCredits += credits;
        }
    }

    const cumulative =
        totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;

    const semesters: { [key: string]: number } = {};
    for (const key in semesterPoints) {
        semesters[key] =
            semesterCredits[key] > 0
                ? parseFloat((semesterPoints[key] / semesterCredits[key]).toFixed(2))
                : 0;
    }

    return { cumulative, semesters, earnedCredits, skippedSubjects };
}
