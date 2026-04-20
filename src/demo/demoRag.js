// ── In-browser RAG utilities for the demo ────────────────────────────────────
// No backend calls. All processing runs in the browser tab.

const CHUNK_SIZE = 600;    // characters per chunk
const CHUNK_OVERLAP = 80;  // overlap between adjacent chunks
const TOP_K = 4;           // chunks retrieved per question
const MAX_CELL_CHARS = 500;
const DEMO_MSG_CAP = 10;   // messages before we soft-cap

// ── Chunking ──────────────────────────────────────────────────────────────────

function splitIntoChunks(text) {
    const chunks = [];
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

async function extractTextFromFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

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

async function extractPdfText(file) {
    // Use pdf.js from CDN if available, else fall back to raw text
    if (typeof window !== 'undefined' && window.pdfjsLib) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pages.push(content.items.map(item => item.str).join(' '));
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

async function extractCsvText(file) {
    const raw = await tryReadWithEncodings(file);
    if (!raw) return '';
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return raw;
    const headers = parseCsvLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = parseCsvLine(lines[i]);
        const parts = headers.map((h, idx) => {
            const v = (vals[idx] || '').trim().slice(0, MAX_CELL_CHARS);
            return v ? `${h}: ${v}` : null;
        }).filter(Boolean);
        if (parts.length) rows.push(parts.join(' | '));
    }
    return rows.join('\n');
}

function parseCsvLine(line) {
    const result = [];
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

async function tryReadWithEncodings(file) {
    const buf = await file.arrayBuffer();
    for (const enc of ['utf-8', 'windows-1252', 'iso-8859-1']) {
        try {
            return new TextDecoder(enc).decode(buf);
        } catch { /* try next */ }
    }
    return '';
}

async function extractExcelText(file) {
    // Dynamic import of SheetJS if available via CDN window.XLSX
    if (typeof window !== 'undefined' && window.XLSX) {
        try {
            const buf = await file.arrayBuffer();
            const wb = window.XLSX.read(buf, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const jsonData = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
            const rows = jsonData.map(row => {
                const parts = Object.entries(row)
                    .map(([k, v]) => {
                        const val = String(v).trim().slice(0, MAX_CELL_CHARS);
                        return val ? `${k}: ${val}` : null;
                    }).filter(Boolean);
                return parts.join(' | ');
            }).filter(Boolean);
            return rows.join('\n');
        } catch { /* fall through */ }
    }
    // Fallback message if SheetJS not loaded
    return 'Excel file uploaded. For best results, convert to CSV format.';
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
}

function scoreChunk(chunk, questionTokens) {
    const chunkTokens = new Set(tokenize(chunk));
    let score = 0;
    for (const t of questionTokens) {
        if (chunkTokens.has(t)) score += 1;
        // Partial match bonus
        for (const ct of chunkTokens) {
            if (ct.includes(t) && ct !== t) score += 0.3;
        }
    }
    return score;
}

export function retrieveChunks(allChunks, question) {
    if (!allChunks.length) return [];
    const qTokens = tokenize(question);
    if (!qTokens.length) return allChunks.slice(0, TOP_K);
    const scored = allChunks.map(chunk => ({ chunk, score: scoreChunk(chunk, qTokens) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, TOP_K).map(s => s.chunk);
}

// ── Gemini API Call ───────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash';

export async function askGemini(question, contextChunks, botConfig, messageCount) {
    if (messageCount >= DEMO_MSG_CAP) {
        return `You've reached the demo message limit (${DEMO_MSG_CAP} messages). Sign up for a free account to keep going — no credit card required!`;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_DEMO_GEMINI_KEY;
    if (!apiKey) {
        return 'Demo chat requires a Gemini API key configured in the environment. Please contact the site admin.';
    }

    const contextText = contextChunks.length
        ? contextChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')
        : 'No relevant context found in the uploaded document.';

    const tone = Array.isArray(botConfig.companyTone)
        ? botConfig.companyTone.join(', ')
        : (botConfig.companyTone_str || 'Professional and helpful');

    const systemPrompt = botConfig.systemPrompt?.trim() ||
        `You are ${botConfig.name}, a helpful AI assistant. Your tone is ${tone}. Answer ONLY from the provided context. If the answer is not in the context, say you don't have that information in the uploaded document. Be concise.`;

    const body = {
        contents: [
            {
                role: 'user',
                parts: [{
                    text: `${systemPrompt}\n\n--- DOCUMENT CONTEXT ---\n${contextText}\n--- END CONTEXT ---\n\nUser question: ${question}`
                }]
            }
        ],
        generationConfig: { maxOutputTokens: 600, temperature: 0.4 }
    };

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err?.error?.message || `API error ${res.status}`;
            return `Sorry, I couldn't process that right now. (${msg})`;
        }
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            "I couldn't generate a response. Please try rephrasing your question.";
    } catch (e) {
        return `Network error: ${e.message}. Please check your connection and try again.`;
    }
}

// ── Main export: parse file → chunks ─────────────────────────────────────────
export async function parseFileToChunks(file) {
    const text = await extractTextFromFile(file);
    if (!text.trim()) throw new Error('No readable text found in the file.');
    // For CSV/Excel, each line is already one structured row — don't re-chunk
    const ext = file.name.split('.').pop().toLowerCase();
    if (['csv', 'xlsx', 'xls'].includes(ext)) {
        const rows = text.split('\n').filter(r => r.trim().length > 10);
        if (!rows.length) throw new Error('No data rows found in the file.');
        return rows;
    }
    const chunks = splitIntoChunks(text);
    if (!chunks.length) throw new Error('File appears to be empty or unreadable.');
    return chunks;
}

export { DEMO_MSG_CAP };
