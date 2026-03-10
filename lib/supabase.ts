import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (!_client) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(/^"|"$/g, '') || undefined;
        if (!url || !key) {
            throw new Error('Supabase env vars not configured');
        }
        _client = createClient(url, key, {
            auth: { autoRefreshToken: false, persistSession: false },
            global: {
                // Next.js App Router はデフォルトで fetch をキャッシュするため
                // DB更新が即座に反映されるよう no-store を指定する
                fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
            },
        });
    }
    return _client;
}
