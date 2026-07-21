import { NextResponse } from 'next/server';
import { getClientIp, checkRateLimit } from '@/src/lib/demo/demoRateLimit';

// pdf-parse is CommonJS with no ESM default export shape TS is happy with —
// requiring it directly avoids the "not a function" trap some bundlers hit
// when they interop-wrap it into { default: fn }.
const pdfParse = require('pdf-parse');

const DEMO_HOURLY_LIMIT = 30; // extraction is heavier than a chat turn — tighter cap
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB, matches the upload UI copy
const MAX_EXTRACT_CHARS = 300_000; // safety valve against pathological PDFs

const demoExtractRateLimitMap = new Map<string, number[]>();

// Collapses the layout noise real PDF text extraction leaves behind (repeated
// spaces from column gaps, blank lines from page breaks) without touching
// intentional paragraph breaks.
function normalizeExtractedText(raw: string): string {
    return raw
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export async function POST(req: Request) {
    try {
        const clientIp = getClientIp(req);
        if (!checkRateLimit(demoExtractRateLimitMap, clientIp, DEMO_HOURLY_LIMIT)) {
            return NextResponse.json(
                { error: `Demo rate limit reached (${DEMO_HOURLY_LIMIT} uploads/hour). Please sign up for full access.` },
                { status: 429 },
            );
        }

        const form = await req.formData();
        const file = form.get('file');
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
        }
        if (file.size > MAX_FILE_BYTES) {
            return NextResponse.json({ error: 'File exceeds the 10 MB demo limit.' }, { status: 400 });
        }
        if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({ error: 'Only PDF files are supported here.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await pdfParse(buffer).catch((e: Error) => {
            throw new Error(`Could not read this PDF (${e.message}). It may be scanned/image-only or corrupted.`);
        });

        const text = normalizeExtractedText(parsed.text || '').slice(0, MAX_EXTRACT_CHARS);
        if (!text) {
            return NextResponse.json(
                { error: "No readable text found in this PDF — it's likely scanned images without a text layer." },
                { status: 422 },
            );
        }

        return NextResponse.json({ text, pages: parsed.numpages ?? null });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to extract text from this file.' }, { status: 500 });
    }
}
