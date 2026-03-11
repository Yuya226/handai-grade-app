import { NextRequest, NextResponse } from 'next/server';
import { Grade, AnalysisResult } from '@/lib/types';
import { calculateGPA } from '@/lib/gpa';
import { validateAndEnrichGrades } from '@/lib/subjects';
import { TOTAL_REQUIRED_CREDITS } from '@/lib/requirements';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { grades: Grade[] };
        if (!Array.isArray(body.grades) || body.grades.length === 0) {
            return NextResponse.json({ error: 'grades array required' }, { status: 400 });
        }

        const enriched = await validateAndEnrichGrades(body.grades);
        const { cumulative, semesters, earnedCredits } = calculateGPA(enriched);

        const response: AnalysisResult = {
            grades: enriched,
            gpa: { cumulative, semesters },
            earnedCredits,
            graduationRequirement: {
                total: TOTAL_REQUIRED_CREDITS,
                current: earnedCredits,
                percentage: Math.round((earnedCredits / TOTAL_REQUIRED_CREDITS) * 100),
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error enriching grades:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
