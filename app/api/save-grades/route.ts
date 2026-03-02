import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SubmissionPayload } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
    let body: SubmissionPayload;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { session_id, faculty, grades, session_gpa } = body;

    if (!UUID_RE.test(session_id)) {
        return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
    }
    if (!faculty || !grades?.length || session_gpa == null) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const rows = grades.map((g) => ({
        session_id,
        faculty,
        subject_name: g.subject,
        grade: g.grade,
        credits: g.credits,
        year: g.year,
        session_gpa,
    }));

    const { error } = await getSupabaseAdmin()
        .from('grade_submissions')
        .upsert(rows, { onConflict: 'session_id,subject_name,year,grade', ignoreDuplicates: true });

    if (error) {
        console.error('Supabase upsert error:', error);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
