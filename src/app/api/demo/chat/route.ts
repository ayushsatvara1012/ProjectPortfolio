import { NextResponse } from 'next/server';
import { getClientIp, checkRateLimit } from '@/src/lib/demo/demoRateLimit';

const GEMINI_MODEL = 'gemini-2.5-flash';
const DEMO_MSG_CAP = 10;
const DEMO_HOURLY_LIMIT = 50; // Hard server-side cap per IP per hour

// Own bucket so chat traffic can't be starved by extraction traffic (or vice versa).
const demoChatRateLimitMap = new Map<string, number[]>();

export async function POST(req: Request) {
    try {
        const clientIp = getClientIp(req);

        // Server-side rate limit (ENFORCED, not bypassable via messageCount)
        if (!checkRateLimit(demoChatRateLimitMap, clientIp, DEMO_HOURLY_LIMIT)) {
            return NextResponse.json({
                text: `Demo rate limit reached (${DEMO_HOURLY_LIMIT} requests/hour). Please sign up for full access.`
            }, { status: 429 });
        }

        const { question, contextChunks, botConfig, messageCount } = await req.json();

        // Secondary: client-side message counter (for UX, but not the security boundary)
        if (messageCount >= DEMO_MSG_CAP) {
            return NextResponse.json({
                text: `You've reached the demo message limit (${DEMO_MSG_CAP} messages). Sign up for a free account to keep going — no credit card required!`
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                text: 'Demo chat requires a Gemini API key configured in the environment. Please contact the site admin.'
            });
        }

        const contextText = contextChunks?.length
            ? contextChunks.map((c: string, i: number) => `[${i + 1}] ${c}`).join('\n\n')
            : 'No relevant context found in the uploaded document.';

        const tone = Array.isArray(botConfig?.companyTone)
            ? botConfig.companyTone.join(', ')
            : (botConfig?.companyTone_str || 'Professional and helpful');

        const systemPrompt = botConfig?.systemPrompt?.trim() ||
            `You are ${botConfig?.name || 'Demo Bot'}, a helpful AI assistant. Your tone is ${tone}. Answer ONLY from the provided context. If the answer is not in the context, say you don't have that information in the uploaded document. Be concise.`;

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

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err?.error?.message || `API error ${res.status}`;
            return NextResponse.json({ text: `Sorry, I couldn't process that right now. (${msg})` });
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            "I couldn't generate a response. Please try rephrasing your question.";

        return NextResponse.json({ text });

    } catch (e: any) {
        return NextResponse.json({
            text: `Network error: ${e.message}. Please check your connection and try again.`
        });
    }
}
