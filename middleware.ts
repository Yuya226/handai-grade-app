import { NextRequest, NextResponse } from 'next/server';

// In-memory sliding-window rate limiter (per Edge instance)
// Adequate for Vercel edge functions which are long-lived per region
const buckets = new Map<string, number[]>();

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (timestamps.length >= limit) return true;
    timestamps.push(now);
    buckets.set(key, timestamps);

    // Periodic cleanup to avoid unbounded memory growth
    if (buckets.size > 10_000) {
        for (const [k, ts] of buckets.entries()) {
            if (ts.every((t) => now - t >= windowMs)) buckets.delete(k);
        }
    }
    return false;
}

function getIp(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

export function middleware(req: NextRequest) {
    const ip = getIp(req);
    const { pathname } = req.nextUrl;

    // POST /api/save-grades: 5 writes per minute per IP
    if (pathname === '/api/save-grades' && req.method === 'POST') {
        if (isRateLimited(`save:${ip}`, 5, 60_000)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }
    }

    // GET /api/stats: 20 requests per minute per IP
    if (pathname === '/api/stats' && req.method === 'GET') {
        if (isRateLimited(`stats:${ip}`, 20, 60_000)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/api/save-grades', '/api/stats'],
};
