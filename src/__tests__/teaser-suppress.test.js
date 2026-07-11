/**
 * Contextual teaser suppression/scheduling — unit tests.
 *
 * Session-scoped (not permanent) suppression: opening the chat silences the
 * teaser everywhere for the rest of the session; dismissing (✕/Esc) only
 * silences the rule that was showing, so a different page/rule is still
 * eligible, with its own delay.
 *
 * These methods live as instance methods on the loader's custom-element class
 * (public/sapybase-loader.js), which self-registers on load and isn't an ES
 * module. Rather than reimplement the logic here (risking divergence from
 * what actually ships), we extract each method's exact source out of the
 * shipped file and run it against a stub instance — same "test the shipped
 * code" principle as teaser-match.test.js, applied to stateful methods
 * instead of pure functions.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const loaderSrc = readFileSync(path.resolve(here, '../../public/sapybase-loader.js'), 'utf8');

function matchBalanced(src, openIdx, openCh, closeCh) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === openCh) depth++;
    else if (src[i] === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('unbalanced ' + openCh + closeCh + ' starting at ' + openIdx);
}

/** Extracts `name(params) { body }` from the shipped class body as a real function. */
function extractMethod(name) {
  const marker = new RegExp('\\n\\s*' + name + '\\s*\\(');
  const m = loaderSrc.match(marker);
  if (!m) throw new Error('method not found in shipped loader: ' + name);
  const parenStart = loaderSrc.indexOf('(', m.index);
  const parenEnd = matchBalanced(loaderSrc, parenStart, '(', ')');
  const braceStart = loaderSrc.indexOf('{', parenEnd);
  const braceEnd = matchBalanced(loaderSrc, braceStart, '{', '}');
  const params = loaderSrc.slice(parenStart + 1, parenEnd);
  const body = loaderSrc.slice(braceStart + 1, braceEnd);
  return new Function(params, body);
}

const methods = {
  _teaserFlagGet: extractMethod('_teaserFlagGet'),
  _teaserFlagSet: extractMethod('_teaserFlagSet'),
  _cancelPendingTeaserTimer: extractMethod('_cancelPendingTeaserTimer'),
  _tryShowTeaserForCurrentPage: extractMethod('_tryShowTeaserForCurrentPage'),
  _engageTeaser: extractMethod('_engageTeaser'),
  _dismissTeaser: extractMethod('_dismissTeaser'),
};

const RESOLUTIONS = {
  pricing: { title: 'Want the best price?', subtext: '', ruleId: 'pricing' },
  products: { title: 'Looking for a product?', subtext: '', ruleId: 'products' },
  none: { title: '', subtext: '', ruleId: 'default' },
};

function makeInstance(resolutionKey = 'pricing') {
  return {
    _botId: 'bot-1',
    _teaserMem: {},
    _open: false,
    _teaser: null,
    _teaserTimer: null,
    _teaserPendingRuleId: null,
    _teaserActiveRuleId: 'default',
    _teaserCfg: { delay_ms: 5000 },
    _teaserRules: [],
    _resolveTeaser: vi.fn(() => RESOLUTIONS[resolutionKey]),
    _updateTeaserText: vi.fn(),
    _showTeaser: vi.fn(),
    _removeTeaser: vi.fn(),
    _unbindTeaserSpa: vi.fn(),
    _bindTeaserSpa: vi.fn(),
    _teaserEvent: vi.fn(),
    ...methods,
  };
}

const call = (instance, method, ...args) => instance[method].call(instance, ...args);

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('_teaserFlagGet / _teaserFlagSet', () => {
  it('round-trips through sessionStorage, scoped by bot id', () => {
    const instance = makeInstance();
    expect(call(instance, '_teaserFlagGet', 'chat')).toBe(false);
    call(instance, '_teaserFlagSet', 'chat');
    expect(call(instance, '_teaserFlagGet', 'chat')).toBe(true);
    // A different bot's flag is independent.
    const other = makeInstance();
    other._botId = 'bot-2';
    expect(call(other, '_teaserFlagGet', 'chat')).toBe(false);
  });

  it('keys per-rule dismissal independently', () => {
    const instance = makeInstance();
    call(instance, '_teaserFlagSet', 'off:pricing');
    expect(call(instance, '_teaserFlagGet', 'off:pricing')).toBe(true);
    expect(call(instance, '_teaserFlagGet', 'off:products')).toBe(false);
  });
});

describe('_tryShowTeaserForCurrentPage', () => {
  it('schedules a timer that shows the teaser after the delay', () => {
    const instance = makeInstance('pricing');
    call(instance, '_tryShowTeaserForCurrentPage');
    expect(instance._showTeaser).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(instance._showTeaser).toHaveBeenCalledTimes(1);
  });

  it('does nothing once the visitor has opened the chat this session', () => {
    const instance = makeInstance('pricing');
    call(instance, '_teaserFlagSet', 'chat');
    call(instance, '_tryShowTeaserForCurrentPage');
    vi.advanceTimersByTime(5000);
    expect(instance._showTeaser).not.toHaveBeenCalled();
  });

  it('does nothing while the chat is currently open', () => {
    const instance = makeInstance('pricing');
    instance._open = true;
    call(instance, '_tryShowTeaserForCurrentPage');
    vi.advanceTimersByTime(5000);
    expect(instance._showTeaser).not.toHaveBeenCalled();
  });

  it('does nothing when the resolved rule has no title', () => {
    const instance = makeInstance('none');
    call(instance, '_tryShowTeaserForCurrentPage');
    vi.advanceTimersByTime(5000);
    expect(instance._showTeaser).not.toHaveBeenCalled();
  });

  it('skips a rule that was already dismissed this session, but still schedules a different one', () => {
    const dismissed = makeInstance('pricing');
    call(dismissed, '_teaserFlagSet', 'off:pricing');
    call(dismissed, '_tryShowTeaserForCurrentPage');
    vi.advanceTimersByTime(5000);
    expect(dismissed._showTeaser).not.toHaveBeenCalled();

    // A DIFFERENT rule, on the same session (same sessionStorage), is unaffected.
    const otherPage = makeInstance('products');
    call(otherPage, '_tryShowTeaserForCurrentPage');
    vi.advanceTimersByTime(5000);
    expect(otherPage._showTeaser).toHaveBeenCalledTimes(1);
  });

  it('swaps the copy in place for an already-visible bubble instead of restarting the delay', () => {
    const instance = makeInstance('products');
    instance._teaser = {}; // a bubble is already up, showing a different rule
    instance._teaserActiveRuleId = 'pricing';
    call(instance, '_tryShowTeaserForCurrentPage');
    expect(instance._updateTeaserText).toHaveBeenCalledWith(RESOLUTIONS.products);
    expect(instance._teaserActiveRuleId).toBe('products');
    expect(instance._showTeaser).not.toHaveBeenCalled();
  });

  it('does not re-swap when the visible bubble already matches the resolved rule', () => {
    const instance = makeInstance('pricing');
    instance._teaser = {};
    instance._teaserActiveRuleId = 'pricing';
    call(instance, '_tryShowTeaserForCurrentPage');
    expect(instance._updateTeaserText).not.toHaveBeenCalled();
  });
});

describe('_engageTeaser (chat opened)', () => {
  it('suppresses every page for the rest of the session', () => {
    const instance = makeInstance('pricing');
    call(instance, '_engageTeaser');
    expect(instance._removeTeaser).toHaveBeenCalledTimes(1);
    expect(instance._unbindTeaserSpa).toHaveBeenCalledTimes(1);
    expect(call(instance, '_teaserFlagGet', 'chat')).toBe(true);

    // A fresh instance in the same session sees the same suppression, on ANY rule.
    const laterPage = makeInstance('products');
    call(laterPage, '_tryShowTeaserForCurrentPage');
    vi.advanceTimersByTime(5000);
    expect(laterPage._showTeaser).not.toHaveBeenCalled();
  });

  it('cancels a pending timer', () => {
    const instance = makeInstance('pricing');
    call(instance, '_tryShowTeaserForCurrentPage');
    call(instance, '_engageTeaser');
    vi.advanceTimersByTime(5000);
    expect(instance._showTeaser).not.toHaveBeenCalled();
  });
});

describe('_dismissTeaser (✕ / Esc)', () => {
  it('only silences the dismissed rule, not the whole session', () => {
    const instance = makeInstance('pricing');
    call(instance, '_dismissTeaser', 'pricing');
    expect(instance._removeTeaser).toHaveBeenCalledTimes(1);
    expect(instance._unbindTeaserSpa).not.toHaveBeenCalled(); // stays bound for other pages
    expect(call(instance, '_teaserFlagGet', 'chat')).toBe(false);
    expect(call(instance, '_teaserFlagGet', 'off:pricing')).toBe(true);

    const otherPage = makeInstance('products');
    call(otherPage, '_tryShowTeaserForCurrentPage');
    vi.advanceTimersByTime(5000);
    expect(otherPage._showTeaser).toHaveBeenCalledTimes(1);
  });

  it('falls back to "default" when no ruleId is given', () => {
    const instance = makeInstance();
    call(instance, '_dismissTeaser', undefined);
    expect(call(instance, '_teaserFlagGet', 'off:default')).toBe(true);
  });
});
