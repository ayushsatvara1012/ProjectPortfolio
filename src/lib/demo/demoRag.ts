const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 80;
const TOP_K = 4;
const MAX_CELL_CHARS = 500;
const DEMO_MSG_CAP = 10;

function splitIntoChunks(text: string) {
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

export async function parseFileToChunks(file: File) {
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

async function extractTextFromFile(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt' || ext === 'md') return await file.text();
    if (ext === 'pdf') return await extractPdfText(file);
    if (ext === 'csv') return await extractCsvText(file);
    if (ext === 'xlsx' || ext === 'xls') return await extractExcelText(file);
    try { return await file.text(); } catch { return ''; }
}

async function extractPdfText(file: File): Promise<string> {
    if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pages.push(content.items.map((item: any) => item.str).join(' '));
            }
            return pages.join('\n\n');
        } catch { /* fallback */ }
    }
    try { return await file.text(); } catch { return ''; }
}

async function extractCsvText(file: File): Promise<string> {
    const raw = await tryReadWithEncodings(file);
    if (!raw) return '';
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return raw;
    const rows2d = lines.slice(0, 15).map(parseCsvLine);
    const headerIdx = findHeaderRow(rows2d);
    const headers = rows2d[headerIdx].map(h => h.trim());
    const rows = [];
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

function parseCsvLine(line: string) {
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

async function tryReadWithEncodings(file: File) {
    const buf = await file.arrayBuffer();
    for (const enc of ['utf-8', 'windows-1252', 'iso-8859-1']) {
        try { return new TextDecoder(enc).decode(buf); } catch { /* next */ }
    }
    return '';
}

function findHeaderRow(rows2d: string[][]) {
    let bestIdx = 0, bestScore = -1;
    for (let i = 0; i < Math.min(rows2d.length, 15); i++) {
        let score = 0;
        for (const v of rows2d[i]) {
            const s = String(v || '').trim();
            if (s && isNaN(Number(s))) score++;
        }
        if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    return bestIdx;
}

async function extractExcelText(file: File): Promise<string> {
    if (typeof window !== 'undefined' && (window as any).XLSX) {
        try {
            const buf = await file.arrayBuffer();
            const wb = (window as any).XLSX.read(buf, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const raw = (window as any).XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as string[][];
            if (!raw.length) return '';
            const headerIdx = findHeaderRow(raw);
            const headers = raw[headerIdx].map(h => String(h).trim());
            const rows = [];
            for (let i = headerIdx + 1; i < raw.length; i++) {
                const vals = raw[i];
                const parts = headers.map((h, idx) => {
                    const val = String(vals[idx] || '').trim().slice(0, MAX_CELL_CHARS);
                    return (h && val) ? `${h}: ${val}` : null;
                }).filter(Boolean);
                if (parts.length) rows.push(parts.join(' | '));
            }
            return rows.join('\n');
        } catch { /* fallback */ }
    }
    return 'Excel file uploaded. Convert to CSV for best results.';
}

export function retrieveChunks(allChunks: string[], question: string) {
    if (!allChunks.length) return [];
    const qTokens = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    if (!qTokens.length) return allChunks.slice(0, TOP_K);
    const scored = allChunks.map(chunk => {
        const cTokens = new Set(chunk.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2));
        let score = 0;
        for (const t of qTokens) {
            if (cTokens.has(t)) score += 1;
            for (const ct of cTokens) if (ct.includes(t) && ct !== t) score += 0.3;
        }
        return { chunk, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, TOP_K).map(s => s.chunk);
}

export async function askGemini(question: string, contextChunks: string[], botConfig: any, messageCount: number) {
    if (messageCount >= DEMO_MSG_CAP) return `Demo limit reached (${DEMO_MSG_CAP} messages). Sign up to continue!`;
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.NEXT_PUBLIC_DEMO_GEMINI_KEY;
    if (!apiKey) return 'API key missing.';
    const contextText = contextChunks.length ? contextChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n\n') : 'No context.';
    const tone = Array.isArray(botConfig.companyTone) ? botConfig.companyTone.join(', ') : (botConfig.companyTone_str || 'Professional');
    const systemPrompt = botConfig.systemPrompt?.trim() || `You are ${botConfig.name}. Answer from context.`;
    const body = {
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nContext:\n${contextText}\n\nQuestion: ${question}` }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.4 }
    };
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Error generating response.";
    } catch (e: any) { return `Network error: ${e.message}`; }
}

export { DEMO_MSG_CAP };
