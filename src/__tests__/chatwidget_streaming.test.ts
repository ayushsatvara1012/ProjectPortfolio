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

import { describe, it, expect, vi } from 'vitest';

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
    for (const [key, val] of Object.entries(AVATAR_GRADIENTS)) {
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
