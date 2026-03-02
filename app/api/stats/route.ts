import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { AggregateStats, HardCourse } from '@/lib/types';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userGpa = parseFloat(searchParams.get('gpa') ?? 'NaN');

    const { data, error } = await getSupabaseAdmin()
        .from('grade_submissions')
        .select('session_id, faculty, session_gpa, subject_name, grade');

    if (error) {
        console.error('Supabase stats error:', error);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!data || data.length === 0) {
        const empty: AggregateStats = {
            totalParticipants: 0,
            collectionRate: 0,
            averageGpa: 0,
            stdDev: 0,
            userPercentile: 50,
            facultyBreakdown: {},
            facultyGpaBreakdown: {},
            hardCourses: [],
        };
        return NextResponse.json(empty);
    }

    // Deduplicate by session_id (keep one row per session for GPA stats)
    const sessionMap = new Map<string, { faculty: string; gpa: number }>();
    for (const row of data) {
        if (!sessionMap.has(row.session_id)) {
            sessionMap.set(row.session_id, { faculty: row.faculty, gpa: row.session_gpa });
        }
    }

    const sessions = Array.from(sessionMap.values());
    const totalParticipants = sessions.length;
    const averageGpa = sessions.reduce((sum, s) => sum + s.gpa, 0) / totalParticipants;
    const variance = sessions.reduce((sum, s) => sum + Math.pow(s.gpa - averageGpa, 2), 0) / totalParticipants;
    const stdDev = Math.sqrt(variance);

    // Faculty participant counts
    const facultyBreakdown: Record<string, number> = {};
    for (const s of sessions) {
        facultyBreakdown[s.faculty] = (facultyBreakdown[s.faculty] ?? 0) + 1;
    }

    // Faculty GPA averages
    const facultyGpaSum: Record<string, { sum: number; count: number }> = {};
    for (const s of sessions) {
        if (!facultyGpaSum[s.faculty]) facultyGpaSum[s.faculty] = { sum: 0, count: 0 };
        facultyGpaSum[s.faculty].sum += s.gpa;
        facultyGpaSum[s.faculty].count += 1;
    }
    const facultyGpaBreakdown: Record<string, number> = {};
    for (const [faculty, { sum, count }] of Object.entries(facultyGpaSum)) {
        facultyGpaBreakdown[faculty] = Math.round((sum / count) * 100) / 100;
    }

    // Hard courses: compute F rate per subject
    const courseStats: Record<string, { total: number; fails: number }> = {};
    for (const row of data) {
        if (!row.subject_name || !row.grade) continue;
        if (!courseStats[row.subject_name]) courseStats[row.subject_name] = { total: 0, fails: 0 };
        courseStats[row.subject_name].total++;
        if (row.grade === 'F') courseStats[row.subject_name].fails++;
    }
    const hardCourses: HardCourse[] = Object.entries(courseStats)
        .filter(([_, s]) => s.total >= 3)
        .map(([subject_name, s]) => ({
            subject_name,
            failRate: Math.round((s.fails / s.total) * 100) / 100,
            totalCount: s.total,
        }))
        .sort((a, b) => b.failRate - a.failRate)
        .slice(0, 10);

    let userPercentile = 50;
    if (!isNaN(userGpa)) {
        const belowOrEqual = sessions.filter((s) => s.gpa <= userGpa).length;
        userPercentile = 100 - Math.round((belowOrEqual / totalParticipants) * 100);
    }

    const stats: AggregateStats = {
        totalParticipants,
        collectionRate: totalParticipants / 15000,
        averageGpa: Math.round(averageGpa * 100) / 100,
        stdDev: Math.round(stdDev * 1000) / 1000,
        userPercentile,
        facultyBreakdown,
        facultyGpaBreakdown,
        hardCourses,
    };

    return NextResponse.json(stats);
}
