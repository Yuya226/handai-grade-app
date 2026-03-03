import { Grade } from './types';

export function calculateGPA(grades: Grade[]) {
    let totalPoints = 0;
    let totalCredits = 0;
    const semesterPoints: { [key: string]: number } = {};
    const semesterCredits: { [key: string]: number } = {};

    grades.forEach((g) => {
        let points = 0;
        let isGPACalculable = true;

        switch (g.grade) {
            case 'S': points = 4; break;
            case 'A': points = 3; break;
            case 'B': points = 2; break;
            case 'C': points = 1; break;
            case 'F': points = 0; break;
            case 'P': isGPACalculable = false; break; // Pass: Not in GPA Denom/Num
            default: isGPACalculable = false;
        }

        const credits = g.credits || 0;

        if (isGPACalculable) {
            totalPoints += points * credits;
            totalCredits += credits;
        }

        const semKey = `${g.year} ${g.semester}`;
        if (!semesterPoints[semKey]) {
            semesterPoints[semKey] = 0;
            semesterCredits[semKey] = 0;
        }

        if (isGPACalculable) {
            semesterPoints[semKey] += points * credits;
            semesterCredits[semKey] += credits;
        }
    });

    const cumulative = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;

    const semesters: { [key: string]: number } = {};
    for (const key in semesterPoints) {
        semesters[key] = semesterCredits[key] > 0 ? parseFloat((semesterPoints[key] / semesterCredits[key]).toFixed(2)) : 0;
    }

    const earnedCredits = grades.filter(g => g.grade !== 'F').reduce((sum, g) => sum + g.credits, 0);

    return { cumulative, semesters, earnedCredits };
}
