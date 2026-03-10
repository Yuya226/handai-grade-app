import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ stale: false });

    const currentVersion = parseInt(process.env.PARSER_VERSION ?? '1');
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .from('grade_submissions')
        .select('parser_version')
        .eq('session_id', sessionId)
        .limit(1)
        .single();

    if (!data) return NextResponse.json({ stale: false });

    const sessionVersion = data.parser_version ?? 0;
    return NextResponse.json({ stale: sessionVersion < currentVersion });
}
