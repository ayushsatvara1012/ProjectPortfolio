// ─── Shared server-side rate limiter for the public /api/demo/* routes ──────
// In-memory, per-IP, per-route (each route keeps its own Map so heavy file/URL
// extraction can't starve the chat budget or vice versa). Good enough for a
// single-region demo surface; not meant to survive a multi-instance deploy.

export function getClientIp(req: Request): string {
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) return forwardedFor.split(',')[0].trim();
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp;
    return 'unknown';
}

export function checkRateLimit(map: Map<string, number[]>, ip: string, hourlyLimit: number): boolean {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    let timestamps = map.get(ip) || [];
    timestamps = timestamps.filter(t => t > oneHourAgo);

    if (timestamps.length >= hourlyLimit) return false;

    timestamps.push(now);
    map.set(ip, timestamps);

    // Defend against unbounded growth from scraper traffic.
    if (map.size > 10000) {
        const entries = Array.from(map.entries());
        entries.sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
        for (let i = 0; i < entries.length / 2; i++) map.delete(entries[i][0]);
    }

    return true;
}
