import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import * as cheerio from 'cheerio';
import { getClientIp, checkRateLimit } from '@/src/lib/demo/demoRateLimit';

const DEMO_HOURLY_LIMIT = 30; // matches the file-extraction bucket
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024; // 3 MB of HTML is plenty for a marketing page
const MAX_EXTRACT_CHARS = 300_000;

const demoExtractUrlRateLimitMap = new Map<string, number[]>();

// ─── SSRF guard ──────────────────────────────────────────────────────────────
// This route fetches a URL supplied by an anonymous, unauthenticated visitor.
// Block loopback/private/link-local targets (including the cloud metadata IP)
// both by hostname literal AND by resolved IP, so a public-looking hostname
// that DNS-rebinds to an internal address still gets rejected before fetch.
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1']);

function isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
}

function isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
}

async function assertPublicUrl(url: URL): Promise<void> {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only http(s) URLs are supported.');
    }
    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
        throw new Error("That URL isn't reachable from the demo.");
    }
    if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
        throw new Error("That URL isn't reachable from the demo.");
    }
    try {
        const { address } = await lookup(hostname);
        if (isPrivateIPv4(address) || isPrivateIPv6(address)) {
            throw new Error("That URL isn't reachable from the demo.");
        }
    } catch {
        throw new Error('Could not resolve that domain.');
    }
}

async function fetchWithCap(url: string): Promise<string> {
    const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VaayuDemoBot/1.0; +https://sapybase.com)',
            Accept: 'text/html,application/xhtml+xml',
        },
    });
    if (!res.ok) throw new Error(`The page returned ${res.status}.`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('xml') && contentType !== '') {
        throw new Error('That URL did not return an HTML page.');
    }

    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    const decoder = new TextDecoder();
    let html = '';
    let bytesRead = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        if (bytesRead > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            break;
        }
        html += decoder.decode(value, { stream: true });
    }
    return html;
}

function htmlToReadableText(html: string): string {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, nav, header, footer, iframe, template').remove();
    const bodyText = $('body').text();
    return bodyText
        .replace(/[ \t]{2,}/g, ' ')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n')
        .slice(0, MAX_EXTRACT_CHARS);
}

export async function POST(req: Request) {
    try {
        const clientIp = getClientIp(req);
        if (!checkRateLimit(demoExtractUrlRateLimitMap, clientIp, DEMO_HOURLY_LIMIT)) {
            return NextResponse.json(
                { error: `Demo rate limit reached (${DEMO_HOURLY_LIMIT} page fetches/hour). Please sign up for full access.` },
                { status: 429 },
            );
        }

        const { url: rawUrl } = await req.json();
        if (!rawUrl || typeof rawUrl !== 'string') {
            return NextResponse.json({ error: 'No URL provided.' }, { status: 400 });
        }

        let url: URL;
        try {
            url = new URL(rawUrl);
        } catch {
            return NextResponse.json({ error: 'Enter a valid URL (https://…).' }, { status: 400 });
        }

        await assertPublicUrl(url);

        const html = await fetchWithCap(url.toString());
        const text = htmlToReadableText(html);

        if (!text || text.length < 20) {
            return NextResponse.json(
                { error: "Couldn't find readable text on that page — it may require JavaScript to render." },
                { status: 422 },
            );
        }

        return NextResponse.json({ text });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to fetch that URL.' }, { status: 500 });
    }
}
