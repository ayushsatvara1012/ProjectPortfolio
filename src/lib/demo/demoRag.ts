// ── In-browser RAG utilities for the demo ────────────────────────────────────
// No backend calls. All processing runs in the browser tab.

const CHUNK_SIZE = 600;    // characters per chunk
const CHUNK_OVERLAP = 80;  // overlap between adjacent chunks
const TOP_K = 4;           // chunks retrieved per question
const MAX_CELL_CHARS = 500;
const DEMO_MSG_CAP = 10;   // messages before we soft-cap

// ── Chunking ──────────────────────────────────────────────────────────────────

function splitIntoChunks(text: string) {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        const chunk = text.slice(start, end).trim();
        if (chunk.length > 20) chunks.push(chunk);
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
}

// ── Plain-text extraction from File ──────────────────────────────────────────

async function extractTextFromFile(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'txt' || ext === 'md') {
        return await file.text();
    }

    if (ext === 'pdf') {
        return await extractPdfText(file);
    }

    if (ext === 'csv') {
        return await extractCsvText(file);
    }

    if (ext === 'xlsx' || ext === 'xls') {
        return await extractExcelText(file);
    }

    // Fallback: try to read as text
    try { return await file.text(); } catch { return ''; }
}

// Real PDF text extraction requires a proper parser (font tables, compressed
// streams) — there's no reliable way to do that from raw bytes in the
// browser, so this hands the file to the server route backing pdf-parse.
// (A previous version tried a `window.pdfjsLib` global that was never
// actually loaded, and silently fell back to reading the file's raw binary
// as text — which is why a 1-page PDF used to "train" as ~17k words of
// PDF-internal structure noise instead of its actual content.)
async function extractPdfText(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/demo/extract-file', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to read this PDF.');
    return data.text || '';
}

async function extractCsvText(file: File): Promise<string> {
    const raw = await tryReadWithEncodings(file);
    if (!raw) return '';
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return raw;

    // Heuristic: find the real header row among the first 15 rows
    const rows2d = lines.slice(0, 15).map(parseCsvLine);
    const headerIdx = _findHeaderRow(rows2d);
    const headers = rows2d[headerIdx].map(h => h.trim());

    const rows: string[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const vals = parseCsvLine(lines[i]);
        const parts = headers.map((h, idx) => {
            const v = (vals[idx] || '').trim().slice(0, MAX_CELL_CHARS);
            return (h && v) ? `${h}: ${v}` : null;
        }).filter(Boolean);
        if (parts.length) rows.push(parts.join(' | '));
    }
    return rows.join('\n');
}

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
        current += ch;
    }
    result.push(current);
    return result;
}

async function tryReadWithEncodings(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    for (const enc of ['utf-8', 'windows-1252', 'iso-8859-1']) {
        try {
            return new TextDecoder(enc).decode(buf);
        } catch { /* try next */ }
    }
    return '';
}

function _rowTextDensity(rowArr: any[]): number {
    let count = 0;
    for (const v of rowArr) {
        const s = String(v == null ? '' : v).trim();
        if (!s || s.toLowerCase() === 'nan') continue;
        if (isNaN(Number(s))) count++; // non-numeric = likely a label
    }
    return count;
}

function _findHeaderRow(rows2d: any[][], scanLimit = 15): number {
    const probe = rows2d.slice(0, scanLimit);
    let bestIdx = 0, bestScore = -1;
    for (let i = 0; i < probe.length; i++) {
        const score = _rowTextDensity(probe[i]);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    return bestIdx;
}

// Excel (.xlsx/.xls) parsing isn't wired up in the demo yet — this used to
// silently return a placeholder sentence that got "trained" as if it were
// real content. Failing loudly with an actionable message is better than
// quietly polluting the bot's knowledge with a sentence that isn't the
// user's data; CSV (already plain text, no parser needed) covers the
// spreadsheet case in the meantime.
async function extractExcelText(_file: File): Promise<string> {
    throw new Error('Excel files aren\'t supported in the demo yet — please export to CSV instead.');
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
}

function scoreChunk(chunk: string, questionTokens: string[]): number {
    const chunkTokens = new Set(tokenize(chunk));
    let score = 0;
    for (const t of questionTokens) {
        if (chunkTokens.has(t)) score += 1;
        for (const ct of chunkTokens) {
            if (ct.includes(t) && ct !== t) score += 0.3;
        }
    }
    return score;
}

export function retrieveChunks(allChunks: string[], question: string): string[] {
    if (!allChunks.length) return [];
    const qTokens = tokenize(question);
    if (!qTokens.length) return allChunks.slice(0, TOP_K);
    const scored = allChunks.map(chunk => ({ chunk, score: scoreChunk(chunk, qTokens) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, TOP_K).map(s => s.chunk);
}

// ── Gemini API Call ───────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash';

export async function askGemini(question: string, contextChunks: string[], botConfig: any, messageCount: number): Promise<string> {
    if (messageCount >= DEMO_MSG_CAP) {
        return `You've reached the demo message limit (${DEMO_MSG_CAP} messages). Sign up for a free account to keep going — no credit card required!`;
    }

    try {
        const res = await fetch('/api/demo/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, contextChunks, botConfig, messageCount })
        });
        
        if (!res.ok) {
             const err = await res.json().catch(() => ({}));
             return err.text || `API error ${res.status}`;
        }
        
        const data = await res.json();
        return data.text || "Error communicating with server.";
    } catch (e: any) {
        return `Network error: ${e.message}. Please check your connection and try again.`;
    }
}

// ── Main export: parse file → chunks ─────────────────────────────────────────
export async function parseFileToChunks(file: File): Promise<string[]> {
    const text = await extractTextFromFile(file);
    if (!text.trim()) throw new Error('No readable text found in the file.');
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && ['csv', 'xlsx', 'xls'].includes(ext)) {
        const rows = text.split('\n').filter(r => r.trim().length > 10);
        if (!rows.length) throw new Error('No data rows found in the file.');
        return rows;
    }
    const chunks = splitIntoChunks(text);
    if (!chunks.length) throw new Error('File appears to be empty or unreadable.');
    return chunks;
}

// ── Main export: parse URL → chunks ──────────────────────────────────────────
// Fetches and extracts the page server-side (browsers can't cross-origin
// fetch arbitrary sites) via /api/demo/extract-url, then chunks the result
// the same way as any other source. Previously this path never fetched
// anything — it just injected a placeholder sentence ("Extracted content
// from {url}") as fake knowledge, which is why URL training never answered
// real questions about the page.
export async function parseUrlToChunks(url: string): Promise<string[]> {
    const res = await fetch('/api/demo/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch that URL.');
    const chunks = splitIntoChunks(data.text || '');
    if (!chunks.length) throw new Error('No readable text found on that page.');
    return chunks;
}

export { DEMO_MSG_CAP };
