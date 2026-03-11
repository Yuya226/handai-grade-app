import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: false,
});

export async function checkRateLimit(req: Request): Promise<Response | null> {
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
        return Response.json({ error: 'Too many requests' }, { status: 429 });
    }
    return null;
}
