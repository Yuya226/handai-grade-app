import { NextRequest, NextResponse } from 'next/server';

// Define the structure for our Grade Data
export interface Grade {
    subject: string;
    semester: string;
    credits: number;
    grade: 'S' | 'A' | 'B' | 'C' | 'F';
    year: number;
}

export interface AnalysisResult {
    grades: Grade[];
    gpa: {
        cumulative: number;
        semesters: { [key: string]: number };
    };
    earnedCredits: number;
    graduationRequirement: {
        total: number;
        current: number;
        percentage: number;
    };
}

// Mock Data representing a parsed transcript
const MOCK_GRADES: Grade[] = [
    { subject: 'Microeconomics I', semester: 'Spring', credits: 2, grade: 'S', year: 2024 },
    { subject: 'Macroeconomics I', semester: 'Fall', credits: 2, grade: 'A', year: 2024 },
    { subject: 'Linear Algebra', semester: 'Spring', credits: 2, grade: 'B', year: 2024 },
    { subject: 'Academic Writing', semester: 'Spring', credits: 1, grade: 'S', year: 2024 },
    { subject: 'Calculus I', semester: 'Spring', credits: 2, grade: 'A', year: 2024 },
    { subject: 'Statistics', semester: 'Fall', credits: 2, grade: 'S', year: 2024 },
    { subject: 'English Communication', semester: 'Fall', credits: 1, grade: 'A', year: 2024 },
    { subject: 'History of Economics', semester: 'Fall', credits: 2, grade: 'B', year: 2024 },
];

function calculateGPA(grades: Grade[]) {
    let totalPoints = 0;
    let totalCredits = 0;
    const semesterPoints: { [key: string]: number } = {};
    const semesterCredits: { [key: string]: number } = {};

    grades.forEach((g) => {
        let points = 0;
        switch (g.grade) {
            case 'S': points = 4; break;
            case 'A': points = 3; break;
            case 'B': points = 2; break;
            case 'C': points = 1; break;
            case 'F': points = 0; break;
        }

        totalPoints += points * g.credits;
        totalCredits += g.credits;

        const semKey = `${g.year} ${g.semester}`;
        if (!semesterPoints[semKey]) {
            semesterPoints[semKey] = 0;
            semesterCredits[semKey] = 0;
        }
        semesterPoints[semKey] += points * g.credits;
        semesterCredits[semKey] += g.credits;
    });

    const cumulative = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;

    const semesters: { [key: string]: number } = {};
    for (const key in semesterPoints) {
        semesters[key] = semesterCredits[key] > 0 ? parseFloat((semesterPoints[key] / semesterCredits[key]).toFixed(2)) : 0;
    }

    return { cumulative, semesters, totalCredits };
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // In a real implementation, we would send this file to Google Cloud Vision API here.
        // For now, we simulate processing time and return mock data.

        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate 1.5s delay

        const { cumulative, semesters, totalCredits } = calculateGPA(MOCK_GRADES);

        const response: AnalysisResult = {
            grades: MOCK_GRADES,
            gpa: {
                cumulative,
                semesters,
            },
            earnedCredits: totalCredits,
            graduationRequirement: {
                total: 124, // Example requirement
                current: totalCredits,
                percentage: Math.round((totalCredits / 124) * 100),
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error processing upload:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
