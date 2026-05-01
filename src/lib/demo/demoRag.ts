// ── In-browser RAG utilities for the demo ────────────────────────────────────
// No backend calls. All processing runs in the browser tab.

const CHUNK_SIZE = 600;    // characters per chunk
const CHUNK_OVERLAP = 80;  // overlap between adjacent chunks
const TOP_K = 4;           // chunks retrieved per question
const MAX_CELL_CHARS = 500;
const DEMO_MSG_CAP = 10;   // messages before we soft-cap

declare global {
    interface Window {
        pdfjsLib: any;
        XLSX: any;
    }
}

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

async function extractPdfText(file: File): Promise<string> {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages: string[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pages.push(content.items.map((item: any) => item.str).join(' '));
            }
            return pages.join('\n\n');
        } catch { /* fall through */ }
    }
    // Fallback: read raw bytes as latin-1 string and strip binary
    try {
        const text = await file.text();
        return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n');
    } catch { return ''; }
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

async function extractExcelText(file: File): Promise<string> {
    if (typeof window !== 'undefined' && window.XLSX) {
        try {
            const buf = await file.arrayBuffer();
            const wb = window.XLSX.read(buf, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];

            const raw = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as any[][];
            if (!raw.length) return '';

            const headerIdx = _findHeaderRow(raw);
            const headers = raw[headerIdx].map(h => String(h).trim());
            const rows: string[] = [];
            for (let i = headerIdx + 1; i < raw.length; i++) {
                const vals = raw[i];
                const parts = headers.map((h, idx) => {
                    const val = String(vals[idx] == null ? '' : vals[idx]).trim().slice(0, MAX_CELL_CHARS);
                    return (h && val) ? `${h}: ${val}` : null;
                }).filter(Boolean);
                if (parts.length) rows.push(parts.join(' | '));
            }
            return rows.join('\n');
        } catch { /* fall through */ }
    }
    return 'Excel file uploaded. For best results, convert to CSV format.';
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

export { DEMO_MSG_CAP };
