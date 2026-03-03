import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Server-side admin client (SERVICE_ROLE_KEY — never expose to browser) ──

let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (!_adminClient) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new Error('Supabase env vars not configured');
        }
        _adminClient = createClient(url, key, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }
    return _adminClient;
}

// ── Browser-side client (ANON_KEY — safe to expose, call only from client components) ──

let _browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
    if (_browserClient) return _browserClient;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
    }
    _browserClient = createClient(url, key);
    return _browserClient;
}
