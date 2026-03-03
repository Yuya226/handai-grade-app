import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { AnalysisResult, Faculty } from '@/lib/types';

/** Extract and verify the Bearer JWT, returning the Supabase user or null. */
async function getAuthUser(req: NextRequest) {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !user) return null;
    return user;
}

/** GET /api/user-snapshot — restore the latest analysis snapshot for the authenticated user. */
export async function GET(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await getSupabaseAdmin()
        .from('user_snapshots')
        .select('analysis_data, faculty')
        .eq('user_id', user.id)
        .single();

    // PGRST116 = "no rows returned" — not an error, just means no snapshot yet
    if (error && error.code !== 'PGRST116') {
        console.error('user_snapshots fetch error:', error);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json(data ?? null);
}

/** POST /api/user-snapshot — upsert an analysis snapshot for the authenticated user. */
export async function POST(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let analysis_data: AnalysisResult;
    let faculty: Faculty | '' | undefined;
    try {
        ({ analysis_data, faculty } = await req.json());
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!analysis_data) {
        return NextResponse.json({ error: 'Missing analysis_data' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
        .from('user_snapshots')
        .upsert(
            {
                user_id: user.id,
                analysis_data,
                faculty: faculty || null,
                session_gpa: analysis_data.gpa.cumulative,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
        );

    if (error) {
        console.error('user_snapshots upsert error:', error);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

/** DELETE /api/user-snapshot — remove the snapshot (called on dashboard reset). */
export async function DELETE(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await getSupabaseAdmin()
        .from('user_snapshots')
        .delete()
        .eq('user_id', user.id);

    if (error) {
        console.error('user_snapshots delete error:', error);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
