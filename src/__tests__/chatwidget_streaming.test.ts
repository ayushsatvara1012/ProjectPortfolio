/**
 * ChatWidget — Streaming Engine & Config Resolution
 *
 * These tests target pure logic extracted from ChatWidget.tsx.
 * We avoid rendering the full component (1,247 lines + SSE) and instead
 * test the pure functions and state logic in isolation.
 *
 * Covers:
 * 1. sanitizeStreamMarkdown — stream-safe markdown repair
 * 2. Config resolution — SapybaseConfig override precedence
 * 3. AVATAR_GRADIENTS / FAB_SHAPES catalog completeness
 * 4. Typewriter buffer logic — drain contract
 * 5. Lead capture trigger detection
 * 6. Quick question normalization
 */

import { describe, it, expect } from 'vitest';

// ── Pure functions mirrored from ChatWidget.tsx ───────────────────────────────
// These are extracted for isolated testing. When ChatWidget changes, update here.

function sanitizeStreamMarkdown(text: string): string {
  let result = text;
  // Close dangling code fences
  const fenceMatches = (result.match(/```/g) || []).length;
  if (fenceMatches % 2 !== 0) result += '\n```';
  // Close dangling bold/italic markers
  const boldCount = (result.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) result += '**';
  return result;
}

function resolveConfig(
  windowConfig: Record<string, any> | undefined,
  apiData: Record<string, any>
) {
  return {
    apiUrl:      windowConfig?.apiUrl      || apiData.api_url      || 'https://sapyai.onrender.com',
    themeColor:  windowConfig?.themeColor  || apiData.theme_color  || '#5730F5',
    botName:     windowConfig?.botName     || apiData.bot_name     || 'Sapy AI',
    logoUrl:     apiData.custom_logo_url   || apiData.logo_url     || '',
    logoShape:   apiData.logo_shape        || windowConfig?.logoShape || 'circle',
    greeting:    apiData.initial_message   || 'Hi! How can I help you today?',
  };
}

function normalizeQuickQuestions(
  raw: unknown
): { label: string; prompt: string }[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(Boolean)
    .map((q) => {
      if (typeof q === 'string') return { label: q, prompt: q };
      if (typeof q === 'object' && q !== null) {
        return {
          label:  String((q as any).label  || (q as any).prompt || ''),
          prompt: String((q as any).prompt || (q as any).label  || ''),
        };
      }
      return null;
    })
    .filter(Boolean) as { label: string; prompt: string }[];
}

// ── 1. sanitizeStreamMarkdown ─────────────────────────────────────────────────

describe('sanitizeStreamMarkdown', () => {
  it('returns clean text unchanged', () => {
    expect(sanitizeStreamMarkdown('Hello world')).toBe('Hello world');
  });

  it('closes a dangling code fence', () => {
    const partial = 'Here is some code:\n```python\nprint("hello")';
    const result = sanitizeStreamMarkdown(partial);
    expect(result).toContain('```');
    const fenceCount = (result.match(/```/g) || []).length;
    expect(fenceCount % 2).toBe(0);
  });

  it('does not modify already-closed code fences', () => {
    const complete = '```python\nprint("hi")\n```';
    expect(sanitizeStreamMarkdown(complete)).toBe(complete);
  });

  it('closes a dangling bold marker', () => {
    const partial = 'This is **important text';
    const result = sanitizeStreamMarkdown(partial);
    const boldCount = (result.match(/\*\*/g) || []).length;
    expect(boldCount % 2).toBe(0);
  });

  it('handles empty string', () => {
    expect(sanitizeStreamMarkdown('')).toBe('');
  });

  it('handles multiple complete fences', () => {
    const text = '```js\nconsole.log(1)\n```\n\n```py\nprint(2)\n```';
    expect(sanitizeStreamMarkdown(text)).toBe(text);
  });
});

// ── 2. Config resolution precedence ──────────────────────────────────────────

describe('Config resolution: window override > API data > defaults', () => {
  it('uses window themeColor over API theme_color', () => {
    const result = resolveConfig({ themeColor: '#FF0000' }, { theme_color: '#0000FF' });
    expect(result.themeColor).toBe('#FF0000');
  });

  it('falls back to API theme_color when no window override', () => {
    const result = resolveConfig(undefined, { theme_color: '#0000FF' });
    expect(result.themeColor).toBe('#0000FF');
  });

  it('falls back to hardcoded default when both missing', () => {
    const result = resolveConfig(undefined, {});
    expect(result.themeColor).toBe('#5730F5');
  });

  it('custom_logo_url takes precedence over logo_url', () => {
    const result = resolveConfig(undefined, {
      logo_url: '/default.svg',
      custom_logo_url: 'https://cdn.example.com/custom.png',
    });
    expect(result.logoUrl).toBe('https://cdn.example.com/custom.png');
  });

  it('falls back to logo_url when custom_logo_url is empty', () => {
    const result = resolveConfig(undefined, {
      logo_url: '/default.svg',
      custom_logo_url: '',
    });
    expect(result.logoUrl).toBe('/default.svg');
  });

  it('logo_shape from API takes precedence over window config', () => {
    const result = resolveConfig({ logoShape: 'sharp' }, { logo_shape: 'bento' });
    expect(result.logoShape).toBe('bento');
  });

  it('defaults logo_shape to circle when absent', () => {
    const result = resolveConfig(undefined, {});
    expect(result.logoShape).toBe('circle');
  });

  it('defaults greeting to fallback string when initial_message is missing', () => {
    const result = resolveConfig(undefined, {});
    expect(result.greeting).toBe('Hi! How can I help you today?');
  });
});

// ── 3. AVATAR_GRADIENTS catalog ───────────────────────────────────────────────

describe('AVATAR_GRADIENTS catalog', () => {
  const AVATAR_GRADIENTS: Record<string, [string, string] | null> = {
    none:   null,
    cosmic: ['#c026d3', '#3b82f6'],
    sunset: ['#f97316', '#eab308'],
    ocean:  ['#06b6d4', '#3b82f6'],
    hacker: ['#22c55e', '#14b8a6'],
  };

  it('has exactly 5 entries', () => {
    expect(Object.keys(AVATAR_GRADIENTS).length).toBe(5);
  });

  it('"none" maps to null', () => {
    expect(AVATAR_GRADIENTS.none).toBeNull();
  });

  it('all non-null entries are 2-element tuples of CSS hex colors', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    for (const val of Object.values(AVATAR_GRADIENTS)) {
      if (val === null) continue;
      expect(val).toHaveLength(2);
      expect(val[0]).toMatch(hexPattern);
      expect(val[1]).toMatch(hexPattern);
    }
  });
});

// ── 4. Typewriter buffer drain contract ───────────────────────────────────────

describe('Typewriter buffer drain contract', () => {
  it('drains buffer character by character in a raf loop', () => {
    const buffer: string[] = [];
    let displayIdx = 0;
    const fullText = 'Hello World';

    // Simulate chars arriving in buffer
    buffer.push(...fullText.split(''));

    // Simulate raf ticks — each tick reveals one char
    const CHARS_PER_TICK = 1;
    function tick() {
      const available = buffer.length;
      const target = Math.min(displayIdx + CHARS_PER_TICK, available);
      displayIdx = target;
    }

    for (let i = 0; i < fullText.length; i++) tick();

    expect(displayIdx).toBe(fullText.length);
    const rendered = buffer.slice(0, displayIdx).join('');
    expect(rendered).toBe('Hello World');
  });

  it('does not exceed buffer length (no index out of bounds)', () => {
    const buffer = ['H', 'i'];
    let displayIdx = 0;

    for (let i = 0; i < 10; i++) {
      displayIdx = Math.min(displayIdx + 1, buffer.length);
    }

    expect(displayIdx).toBe(buffer.length);
    expect(displayIdx).toBeLessThanOrEqual(buffer.length);
  });

  it('isFinished when displayIdx reaches buffer length', () => {
    const buffer = ['a', 'b', 'c'];
    let displayIdx = buffer.length;
    const isFinished = displayIdx >= buffer.length;
    expect(isFinished).toBe(true);
  });

  it('is not finished when buffer has more chars than displayed', () => {
    const buffer = ['a', 'b', 'c'];
    const displayIdx = 1;
    const isFinished = displayIdx >= buffer.length;
    expect(isFinished).toBe(false);
  });
});

// ── 5. Lead capture trigger detection ────────────────────────────────────────

describe('Lead capture trigger detection', () => {
  function shouldTriggerLeadCapture(
    msgCount: number,
    alreadyCaptured: boolean,
    leadCaptureAfter: number | null
  ): boolean {
    if (alreadyCaptured) return false;
    if (leadCaptureAfter === null || leadCaptureAfter === undefined) return false;
    return msgCount >= leadCaptureAfter;
  }

  it('triggers at the configured message threshold', () => {
    expect(shouldTriggerLeadCapture(3, false, 3)).toBe(true);
  });

  it('does not trigger before the threshold', () => {
    expect(shouldTriggerLeadCapture(2, false, 3)).toBe(false);
  });

  it('does not trigger when already captured', () => {
    expect(shouldTriggerLeadCapture(5, true, 3)).toBe(false);
  });

  it('does not trigger when leadCaptureAfter is null (disabled)', () => {
    expect(shouldTriggerLeadCapture(100, false, null)).toBe(false);
  });

  it('triggers at message 1 when threshold is 1', () => {
    expect(shouldTriggerLeadCapture(1, false, 1)).toBe(true);
  });
});

// ── 5b. Generic lead form suppressed for vertical/agentic bots ───────────────
// Mirrors the [DONE] heuristic in ChatWidget: the keyword-based generic lead form
// must NOT fire for a vertical/pack bot, which runs its own structured capture
// (request_quote's contact step, the sample form, handoff). Regression for the
// form popping mid-quote while the agent was still asking for grade/pack size.

describe('Generic lead form vs vertical bot', () => {
  const userBuyingIntent = ['quote', 'pricing', 'how much', 'cost', 'buy', 'purchase', 'hire', 'sign up', 'get started', 'book a', 'schedule', 'free trial', 'demo', 'subscribe'];
  const userHumanIntent = ['talk to a human', 'speak to someone', 'real person', 'contact you', 'reach out', 'get in touch', 'help me', 'i need help', 'support team', 'sales team'];
  const fallbackPhrases = ['does not appear in my knowledge base', "don't have information on that", 'please reach out to', "i'm not sure", 'i do not have'];

  function shouldShowGenericLeadForm(
    userMsg: string,
    botReply: string,
    opts: { leadCaptureEnabled: boolean; alreadyShown: boolean; isVerticalBot: boolean }
  ): boolean {
    if (!opts.leadCaptureEnabled || opts.alreadyShown || opts.isVerticalBot) return false;
    const u = userMsg.toLowerCase();
    const r = botReply.toLowerCase();
    const isBuying = userBuyingIntent.some(w => u.includes(w));
    const isHuman = userHumanIntent.some(w => u.includes(w));
    const isFallback = fallbackPhrases.some(w => r.includes(w));
    return isBuying || isHuman || isFallback;
  }

  const base = { leadCaptureEnabled: true, alreadyShown: false, isVerticalBot: false };

  it('fires on buying intent for a generic bot', () => {
    expect(shouldShowGenericLeadForm("I'd like a price quote for Ethanol.", 'Sure!', base)).toBe(true);
  });

  it('does NOT fire on a quote for a vertical bot (agent handles capture)', () => {
    expect(shouldShowGenericLeadForm(
      "I'd like a price quote for Ethanol.",
      'I need to know the grade and pack size you are interested in.',
      { ...base, isVerticalBot: true }
    )).toBe(false);
  });

  it('does NOT fire on human-intent for a vertical bot', () => {
    expect(shouldShowGenericLeadForm('can I talk to a human', 'Let me connect you.', { ...base, isVerticalBot: true })).toBe(false);
  });

  it('does NOT fire on a fallback reply for a vertical bot', () => {
    expect(shouldShowGenericLeadForm('random thing', "i'm not sure about that", { ...base, isVerticalBot: true })).toBe(false);
  });

  it('still suppressed when lead capture disabled, regardless of vertical', () => {
    expect(shouldShowGenericLeadForm('quote please', 'ok', { ...base, leadCaptureEnabled: false })).toBe(false);
  });
});

// ── 6. Quick question normalization ──────────────────────────────────────────

describe('normalizeQuickQuestions', () => {
  it('handles null/undefined', () => {
    expect(normalizeQuickQuestions(null)).toEqual([]);
    expect(normalizeQuickQuestions(undefined)).toEqual([]);
  });

  it('parses a JSON string array of strings', () => {
    const result = normalizeQuickQuestions('["What are your hours?","Do you deliver?"]');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ label: 'What are your hours?', prompt: 'What are your hours?' });
  });

  it('parses an array of label/prompt objects', () => {
    const input = [{ label: 'Pricing', prompt: 'Tell me about pricing' }];
    const result = normalizeQuickQuestions(input);
    expect(result[0]).toEqual({ label: 'Pricing', prompt: 'Tell me about pricing' });
  });

  it('handles objects with only label (no prompt)', () => {
    const result = normalizeQuickQuestions([{ label: 'FAQ' }]);
    expect(result[0].prompt).toBe('FAQ');
  });

  it('filters out empty/falsy entries', () => {
    const result = normalizeQuickQuestions(['', null, 'Valid question']);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Valid question');
  });

  it('returns empty array for malformed JSON string', () => {
    expect(normalizeQuickQuestions('not valid json [')).toEqual([]);
  });

  it('returns empty array for non-array JSON (object)', () => {
    expect(normalizeQuickQuestions('{"key":"value"}')).toEqual([]);
  });

  it('passes through already-parsed array', () => {
    const input = [{ label: 'A', prompt: 'B' }, { label: 'C', prompt: 'D' }];
    expect(normalizeQuickQuestions(input)).toHaveLength(2);
  });
});

// ── 7. Escalate side-channel (capture-then-connect, plan §1.6) ───────────────

describe('escalate SSE event', () => {
  // Mirrors the onmessage branch: the widget renders whatever the server decided,
  // and refuses a payload with no usable destination rather than guessing one.
  function parseEscalate(data: string): { destination: string; cause?: string } | null {
    let parsed: Record<string, any>;
    try { parsed = JSON.parse(data); } catch { return null; }
    if (parsed.escalate && (parsed.escalate.destination === 'handoff' || parsed.escalate.destination === 'lead_capture')) {
      return { destination: parsed.escalate.destination, cause: parsed.escalate.cause };
    }
    return null;
  }

  // Mirrors the [DONE] gate: once per conversation, and never after a capture.
  function shouldShowConnectForm(
    escalate: { destination: string } | null,
    alreadyCaptured: boolean,
    formAlreadyShown: boolean,
  ): boolean {
    return Boolean(escalate) && !alreadyCaptured && !formAlreadyShown;
  }

  it('reads the cause and destination the server sent', () => {
    expect(parseEscalate('{"escalate":{"cause":"person_requested","destination":"handoff"}}'))
      .toEqual({ destination: 'handoff', cause: 'person_requested' });
  });

  it('accepts the lead-capture destination', () => {
    expect(parseEscalate('{"escalate":{"cause":"buying_intent","destination":"lead_capture"}}')?.destination)
      .toBe('lead_capture');
  });

  it('ignores an unknown destination rather than inventing a form', () => {
    expect(parseEscalate('{"escalate":{"cause":"person_requested","destination":"telepathy"}}')).toBeNull();
  });

  it('ignores an ordinary token frame', () => {
    expect(parseEscalate('{"token":"Hello"}')).toBeNull();
  });

  it('shows the form once per conversation', () => {
    const escalate = { destination: 'handoff' };
    expect(shouldShowConnectForm(escalate, false, false)).toBe(true);
    expect(shouldShowConnectForm(escalate, false, true)).toBe(false);
  });

  it('never asks again once the visitor has already given their details', () => {
    expect(shouldShowConnectForm({ destination: 'handoff' }, true, false)).toBe(false);
  });

  it('no event => no form, whatever the reply said', () => {
    // The three keyword lists that used to make this call client-side are gone.
    expect(shouldShowConnectForm(null, false, false)).toBe(false);
  });
});

// ── 8. Stream error frame (audit F2) ─────────────────────────────────────────

describe('error SSE frame', () => {
  // Mirrors the onmessage branch added in Phase 5. The frame used to be ignored:
  // no token rendered, [DONE] never arrived (the backend returned right after the
  // error), so isStreaming never cleared and the bubble typed forever.
  function handleFrame(data: string): { kind: 'error' | 'token' | 'other'; text?: string } {
    if (data === '[DONE]') return { kind: 'other' };
    let parsed: Record<string, any>;
    try { parsed = JSON.parse(data); } catch { return { kind: 'token', text: data }; }
    if (typeof parsed.error === 'string') {
      return { kind: 'error', text: "Sorry - something went wrong at my end and I lost that answer. Please try again." };
    }
    const chunk = parsed.token || parsed.content || parsed.text || '';
    return chunk ? { kind: 'token', text: chunk } : { kind: 'other' };
  }

  // Mirrors [DONE]: the buffered text wins, the error text is the fallback for an
  // error that arrived before the typewriter buffer existed.
  function resolveFinalContent(buffered: string, streamErrorText: string): string {
    return buffered || streamErrorText;
  }

  it('turns an error frame into readable text', () => {
    const result = handleFrame('{"error":"Stream interrupted"}');
    expect(result.kind).toBe('error');
    expect(result.text).toContain('something went wrong');
  });

  it('still treats an ordinary token as a token', () => {
    expect(handleFrame('{"token":"Hello"}')).toEqual({ kind: 'token', text: 'Hello' });
  });

  it('falls back to the error text when nothing was buffered', () => {
    expect(resolveFinalContent('', 'Sorry - something went wrong')).toBe('Sorry - something went wrong');
  });

  it('prefers real streamed content over the error text', () => {
    // A stream that broke after partial output keeps what the visitor already read.
    expect(resolveFinalContent('Acetone AR ships', 'Sorry - something went wrong')).toBe('Acetone AR ships');
  });

  it('leaves the bubble empty only when there is genuinely nothing', () => {
    expect(resolveFinalContent('', '')).toBe('');
  });
});
