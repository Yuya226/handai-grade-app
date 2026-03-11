import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SubmissionPayload } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WRITE_COOKIE = 'swt'; // session write token
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function makeWriteToken(sessionId: string): string {
    const secret = process.env.WRITE_TOKEN_SECRET ?? 'dev-secret-change-me';
    return createHmac('sha256', secret).update(sessionId).digest('hex');
}

function verifyWriteToken(sessionId: string, token: string): boolean {
    try {
        const expected = Buffer.from(makeWriteToken(sessionId), 'hex');
        const actual = Buffer.from(token, 'hex');
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
        return false;
    }
}

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
    if (!grades?.length || session_gpa == null) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (grades.some(g => g.grade === null)) {
        return NextResponse.json({ error: 'grades contain null grade' }, { status: 400 });
    }

    // Session ownership check:
    // If the client has a write token cookie, it must match this session_id.
    // This prevents overwriting another user's data even if their session_id leaks.
    const existingToken = req.cookies.get(WRITE_COOKIE)?.value;
    if (existingToken && !verifyWriteToken(session_id, existingToken)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // 既存データを全削除してから入れ直す（再アップロード時の二重カウントを防ぐ）
    const { error: deleteError } = await supabase
        .from('grade_submissions')
        .delete()
        .eq('session_id', session_id);

    if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const parserVersion = parseInt(process.env.PARSER_VERSION ?? '1');
    const rows = grades.map((g) => ({
        session_id,
        faculty,
        subject_name: g.subject,
        course_code: g.courseCode ?? null,
        grade: g.grade,
        credits: g.credits,
        year: g.year,
        session_gpa,
        parser_version: parserVersion,
    }));

    const { error } = await supabase
        .from('grade_submissions')
        .upsert(rows, { onConflict: 'session_id,subject_name,year,grade', ignoreDuplicates: true });

    if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });

    // Issue (or refresh) the write token cookie so only this browser can overwrite this session.
    if (!existingToken) {
        res.cookies.set(WRITE_COOKIE, makeWriteToken(session_id), {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: COOKIE_MAX_AGE,
            path: '/',
        });
    }

    return res;
}
