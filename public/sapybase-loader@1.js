(function () {
  'use strict';

  // Don't run inside our own embed iframe — the embed page already renders
  // the full ChatWidget. Re-running the loader there produces a nested FAB
  // and a duplicate chat panel.
  try {
    if (window.self !== window.top) return;
  } catch (e) {
    // Cross-origin access threw — we are framed. Bail out.
    return;
  }

  // Graceful degradation for very old browsers (IE, pre-Edge, pre-iOS 10).
  // Custom Elements v1, fetch, and Shadow DOM are required. If any are
  // missing, fail silently — the host site is unaffected.
  if (
    typeof window.customElements === 'undefined' ||
    typeof window.fetch !== 'function' ||
    typeof window.HTMLElement === 'undefined' ||
    !HTMLElement.prototype.attachShadow
  ) {
    return;
  }

  // Fix #2: double-mount guard — if script is loaded twice, bail out early
  try {
    if (customElements.get('sapybase-widget')) return;
  } catch (e) {
    // Some legacy polyfills throw on .get(); treat as already-defined.
    return;
  }

  const IFRAME_ORIGIN =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : 'https://www.sapybase.com';

  // Origin where loader assets (e.g. /SB_loading.svg) are served from.
  // Always points at the Sapybase origin so the brand fallback resolves on
  // third-party host pages even when the loader was served from a CDN copy.
  var ASSET_BASE = IFRAME_ORIGIN;
  var BRAND_LOGO_URL = ASSET_BASE + '/SB_loading.svg';

  // FAB shape paths — must stay in sync with FAB_SHAPES in
  // src/app/components/avatar/AvatarShared.ts (the canonical source of truth).
  // This file cannot import ES modules, so the paths are inlined here.
  // Each entry includes per-shape offsets to nudge logo/text into the visual
  // center of asymmetric shapes.
  var FAB_SHAPES = {
    circle:   { path: 'M 50 4 C 75.5 4 96 24.5 96 50 C 96 75.5 75.5 96 50 96 C 24.5 96 4 75.5 4 50 C 4 24.5 24.5 4 50 4 Z', x: 0, y: 0 },
    squircle: { path: 'M 22 4 H 78 Q 96 4 96 22 V 62 Q 96 80 78 80 H 36 L 18 96 L 22 80 H 22 Q 4 80 4 62 V 22 Q 4 4 22 4 Z', x: 0, y: -8 },
    bento:    { path: 'M39.5 0H60.5A39.5 39.5 0 0160.5 79H46Q40 79 27 90 35 79 32 78A39.5 39.5 0 0139.5 0Z', x: 0, y: -10.5 },
    sharp:    { path: 'M50 3C77 3 97 23 97 50 97 77 77 97 50 97 35 97 26 90 26 90L9 97 15 83C6 71 3 61 3 50 3 23 23 3 50 3Z', x: 0, y: 0 },
    'rounded-square': { path: 'M20 0H80A20 20 0 0 1 100 20V80A20 20 0 0 1 80 100H20A20 20 0 0 1 0 80V20A20 20 0 0 1 20 0Z', x: 0, y: 0 },
  };

  // Color helpers used by FAB theming. Kept tiny — no full color library.
  function _hexToRgba(hex, alpha) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    if (isNaN(n)) return 'rgba(87,48,245,' + alpha + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }
  // Render the FAB as a shape-clipped SVG that matches BotAvatar in
  // ChatWidget. For custom (uploaded) logos the image fills the full 100x100
  // viewBox and is clipped by the shape; for the default Sapybase logo a
  // smaller 70x70 inset is used so it doesn't bleed past the shape.
  function _buildFabSvg(shape, themeColor, darkColor, logoUrl, isCustom, botName) {
    var sfx = Math.random().toString(36).slice(2, 8);
    var gradId = 'sb-fab-grad-' + sfx;
    var clipId = 'sb-fab-clip-' + sfx;
    var safeUrl = logoUrl ? String(logoUrl).replace(/"/g, '&quot;') : '';
    var initial = (botName || 'S').charAt(0).toUpperCase();
    var ox = shape.x || 0;
    var oy = shape.y || 0;

    var content = '';
    if (safeUrl) {
      var ix = isCustom ? ox : 15 + ox;
      var iy = isCustom ? oy : 15 + oy;
      var iw = isCustom ? 100 : 70;
      var ih = isCustom ? 100 : 70;
      content =
        '<g clip-path="url(#' + clipId + ')">' +
        '<image href="' + safeUrl + '" x="' + ix + '" y="' + iy + '" ' +
        'width="' + iw + '" height="' + ih + '" preserveAspectRatio="xMidYMid slice" />' +
        '</g>';
    } else {
      content =
        '<text x="' + (50 + ox) + '" y="' + (52 + oy) + '" ' +
        'text-anchor="middle" dominant-baseline="middle" fill="#ffffff" ' +
        'style="font-size:38px;font-weight:700;font-family:system-ui,sans-serif;">' +
        initial + '</text>';
    }

    return (
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" ' +
      'style="width:100%;height:100%;overflow:visible;display:block;" ' +
      'preserveAspectRatio="xMidYMid meet">' +
      '<defs>' +
      '<linearGradient id="' + gradId + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="' + themeColor + '"/>' +
      '<stop offset="100%" stop-color="' + darkColor + '"/>' +
      '</linearGradient>' +
      '<clipPath id="' + clipId + '"><path d="' + shape.path + '"/></clipPath>' +
      '</defs>' +
      '<path d="' + shape.path + '" fill="url(#' + gradId + ')"/>' +
      content +
      '</svg>'
    );
  }

  function _shadeColor(hex, percent) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    if (isNaN(n)) return hex;
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = (100 + percent) / 100;
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  class SapybaseWidget extends HTMLElement {
    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'closed' });
      this._open = false;
      this._iframeLoaded = false;
      this._iframe = null;
      this._botId = null;
      this._wrap = null;
      this._fab = null;
      this._label = null;
      this._revealed = false;
      // Typewriter tooltip state.
      this._tipMessages = ['Need help !', 'Chat with me', 'Powered by sapybase'];
      this._tipMsgIdx = 0;
      this._tipTimer = null;
      this._tipTextNode = null;
      this._tipCaret = null;
      this._tipPaused = false;
      this._tipDismissed = false;
      this._onTipVisibility = null;
      this._onTipDismiss = null;
    }

    connectedCallback() {
      // Custom elements fire connectedCallback every time they're appended,
      // including on reseat. Render once.
      if (this._mounted) return;
      this._mounted = true;
      // Fix #1: read data-bot-id (plan convention) with fallback to bot-id
      const botId =
        this.getAttribute('data-bot-id') ||
        this.getAttribute('bot-id') ||
        (window.SapybaseConfig && window.SapybaseConfig.apiKey);

      if (!botId) {
        console.error('[Sapybase] No data-bot-id provided.');
        return;
      }

      // Fix #4: read data-position attribute
      const position = this.getAttribute('data-position') || 'bottom-right';

      this._botId = botId;

      // Fix #3: inject ld+json SEO schema into host <head>
      this._injectSEO(botId);

      // Fetch bot config for FAB customization. Render with defaults first
      // so the FAB shows up even if the request fails or is slow, then
      // re-style on success.
      this._render(position, null);
      this._listenForMessages();

      // Safety: if /api/config is slow or unreachable, reveal the FAB anyway
      // after 2s so users always have a way to open the chat.
      const revealTimer = setTimeout(() => this._reveal(), 2000);

      this._fetchConfig(botId).then((cfg) => {
        clearTimeout(revealTimer);
        if (cfg) this._applyConfig(cfg);
        else console.warn('[Sapybase] /api/config returned no usable data; FAB will keep defaults.');
        this._reveal();
      });
    }

    _reveal() {
      if (this._revealed) return;
      this._revealed = true;
      if (this._fab) this._fab.classList.add('ready');
      this._startTooltipCycle();
    }

    // ── Cycling typewriter tooltip ─────────────────────────────────────────
    _startTooltipCycle() {
      if (this._tipDismissed) return;
      // Tagline is iPad-and-larger only. Skip the cycle entirely on phones
      // so we don't burn timers when the bubble is CSS-hidden.
      if (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) return;
      try {
        if (window.sessionStorage &&
            window.sessionStorage.getItem('sapybase:tooltip-dismissed') === '1') {
          this._tipDismissed = true;
          return;
        }
      } catch (e) { /* sessionStorage may throw under strict cookie policies */ }

      // First user touch/hover/click on the FAB dismisses the cycle for the
      // rest of the session. pointerdown covers mouse + touch in one event.
      this._onTipDismiss = () => this._dismissTooltip(/*persist*/ true);
      if (this._fab) {
        this._fab.addEventListener('pointerdown', this._onTipDismiss, { once: true });
        this._fab.addEventListener('mouseenter', this._onTipDismiss, { once: true });
      }

      // Pause the cycle when the tab is hidden — no animation budget burned
      // on a backgrounded page.
      this._onTipVisibility = () => {
        this._tipPaused = document.hidden;
        if (!this._tipPaused && !this._tipDismissed) this._scheduleTipStep(0);
      };
      document.addEventListener('visibilitychange', this._onTipVisibility);

      // Show the bubble shell first, then begin typing.
      this._label.classList.add('show');
      this._tipMsgIdx = 0;
      this._typeMessage(this._tipMessages[0], 0);
    }

    _scheduleTipStep(delay) {
      if (this._tipDismissed || this._tipPaused) return;
      clearTimeout(this._tipTimer);
      this._tipTimer = setTimeout(() => this._nextTipMessage(), delay);
    }

    _typeMessage(text, charIdx) {
      if (this._tipDismissed) return;
      if (this._tipPaused) {
        // Resume from the same position when tab becomes visible again.
        this._tipTimer = setTimeout(() => this._typeMessage(text, charIdx), 250);
        return;
      }

      const reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        this._tipTextNode.nodeValue = text;
        this._scheduleTipStep(2200);
        return;
      }

      if (charIdx <= text.length) {
        this._tipTextNode.nodeValue = text.slice(0, charIdx);
        const ch = text.charAt(charIdx - 1);
        const base = /[.!?,]/.test(ch) ? 140 : 70;
        const jitter = (Math.random() * 20) - 10;
        this._tipTimer = setTimeout(
          () => this._typeMessage(text, charIdx + 1),
          base + jitter
        );
      } else {
        // Hold full message, then erase.
        this._tipTimer = setTimeout(() => this._eraseMessage(text, text.length), 2000);
      }
    }

    _eraseMessage(text, charIdx) {
      if (this._tipDismissed) return;
      if (this._tipPaused) {
        this._tipTimer = setTimeout(() => this._eraseMessage(text, charIdx), 250);
        return;
      }

      const reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        this._tipTextNode.nodeValue = '';
        this._scheduleTipStep(400);
        return;
      }

      if (charIdx >= 0) {
        this._tipTextNode.nodeValue = text.slice(0, charIdx);
        this._tipTimer = setTimeout(
          () => this._eraseMessage(text, charIdx - 1),
          35
        );
      } else {
        this._scheduleTipStep(400);
      }
    }

    _nextTipMessage() {
      if (this._tipDismissed) return;
      this._tipMsgIdx = (this._tipMsgIdx + 1) % this._tipMessages.length;
      this._typeMessage(this._tipMessages[this._tipMsgIdx], 0);
    }

    _dismissTooltip(persist) {
      if (this._tipDismissed) return;
      this._tipDismissed = true;
      clearTimeout(this._tipTimer);
      if (this._label) this._label.classList.remove('show');
      if (persist) {
        try {
          window.sessionStorage &&
            window.sessionStorage.setItem('sapybase:tooltip-dismissed', '1');
        } catch (e) { /* ignore */ }
      }
    }

    _stopTooltipCycle() {
      clearTimeout(this._tipTimer);
      if (this._onTipVisibility) {
        document.removeEventListener('visibilitychange', this._onTipVisibility);
        this._onTipVisibility = null;
      }
      if (this._fab && this._onTipDismiss) {
        this._fab.removeEventListener('pointerdown', this._onTipDismiss);
        this._fab.removeEventListener('mouseenter', this._onTipDismiss);
      }
    }

    disconnectedCallback() {
      this._stopTooltipCycle();
    }

    _fetchConfig(botId) {
      try {
        // cache: 'no-store' ensures we never get a stale 304 with an empty
        // body — the backend already caches via Redis with a 5-minute TTL.
        return fetch(IFRAME_ORIGIN + '/api/config', {
          cache: 'no-store',
          headers: {
            'accept': 'application/json',
            'x-api-key': botId,
            'x-Sapybase-parent-origin': window.location.origin,
          },
        })
          .then(function (res) {
            if (!res.ok) {
              console.warn('[Sapybase] /api/config returned ' + res.status);
              return null;
            }
            return res.json();
          })
          .catch(function (err) {
            console.warn('[Sapybase] /api/config fetch failed:', err);
            return null;
          });
      } catch (e) {
        return Promise.resolve(null);
      }
    }

    _applyConfig(cfg) {
      const themeColor = cfg.theme_color || '#5730F5';
      const shapeId = cfg.logo_shape || 'circle';
      const shape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
      const logoUrl = cfg.custom_logo_url || cfg.logo_url || BRAND_LOGO_URL;
      const isCustom = !!cfg.custom_logo_url;
      const botName = cfg.bot_name || 'Sapy AI';

      if (this._fab) {
        const dark = _shadeColor(themeColor, -20);

        // For all shapes we render an SVG so the logo can be clipped to the
        // shape path. The button itself becomes a transparent shell.
        this._fab.style.borderRadius = '0';
        this._fab.style.background = 'transparent';
        this._fab.style.boxShadow = 'none';
        this._fab.style.padding = '0';
        this._fab.style.overflow = 'visible';
        this._fab.innerHTML = _buildFabSvg(shape, themeColor, dark, logoUrl, isCustom, botName);
      }

      // Drop the "Powered by Sapybase" tease when the merchant has paid for
      // white-label branding — they shouldn't be advertising us.
      if (cfg.white_label_enabled === true) {
        this._tipMessages = this._tipMessages.filter(function (m) {
          return m.indexOf('Powered by') === -1;
        });
      }
    }

    // SEO injection: emits two ld+json blocks into the host <head>.
    // 1. WebApplication: identifies the widget itself. No `offers` block —
    //    the merchant's page sells different products and a $0 Offer here
    //    would be misleading schema.
    // 2. FAQPage: fetched per-bot from the backend. This is the block that
    //    actually helps the merchant rank in AI Overviews / SGE answer cards.
    _injectSEO(botId) {
      if (document.querySelector('script[data-sapybase-seo]')) return;

      var appScript = document.createElement('script');
      appScript.type = 'application/ld+json';
      appScript.dataset.sapybaseSeo = 'true';
      appScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Sapybase AI Assistant',
        url: IFRAME_ORIGIN + '/embed/' + botId,
        applicationCategory: 'CustomerSupportApplication',
        operatingSystem: 'Web',
        description: 'AI-powered customer support chatbot embedded on this site',
      });
      document.head.appendChild(appScript);

      // Best-effort FAQ injection. Failures are silent — SEO is non-critical
      // and must never block widget bootstrap.
      try {
        fetch(IFRAME_ORIGIN + '/api/bots/' + encodeURIComponent(botId) + '/faqs', {
          headers: { 'accept': 'application/json' },
        })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (data) {
            if (!data || !Array.isArray(data.faqs) || data.faqs.length === 0) return;
            var faqScript = document.createElement('script');
            faqScript.type = 'application/ld+json';
            faqScript.dataset.sapybaseFaq = 'true';
            faqScript.textContent = JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: data.faqs.slice(0, 10).map(function (f) {
                return {
                  '@type': 'Question',
                  name: f.question,
                  acceptedAnswer: { '@type': 'Answer', text: f.answer },
                };
              }),
            });
            document.head.appendChild(faqScript);
          })
          .catch(function () { /* noop */ });
      } catch (e) { /* noop */ }
    }

    _render(position, cfg) {
      const isLeft = position === 'bottom-left';
      const themeColor =
        (cfg && cfg.theme_color) ||
        (window.SapybaseConfig && window.SapybaseConfig.themeColor) ||
        '#5730F5';

      const style = document.createElement('style');
      style.textContent = [
        ':host {',
        '  all: initial;',
        '  position: fixed;',
        // Host pages can lower this with `sapybase-widget { --sapybase-z: 9999; }`
        '  z-index: var(--sapybase-z, 2147483647);',
        '  ' + (isLeft ? 'left: 20px;' : 'right: 20px;'),
        '  bottom: 20px;',
        '  font-family: system-ui, -apple-system, sans-serif;',
        '}',
        '.fab {',
        '  width: 64px; height: 64px; border-radius: 50%; cursor: pointer;',
        '  background: linear-gradient(135deg, ' + themeColor + ', #4f46e5);',
        '  box-shadow: 0 4px 24px rgba(87,48,245,.35); border: none;',
        '  padding: 0; overflow: visible;',
        '  display: flex; align-items: center; justify-content: center;',
        // Suppress iOS/iPadOS gray tap-highlight rectangle and long-press
        // callout. Keyboard users still get a ring via :focus-visible below.
        '  -webkit-tap-highlight-color: transparent;',
        '  -webkit-touch-callout: none;',
        '  user-select: none; -webkit-user-select: none;',
        '  touch-action: manipulation;',
        // Hidden until /api/config resolves (or 2s safety timeout) so the
        // unbranded placeholder never flashes.
        '  opacity: 0; transform: scale(.85);',
        '  transition: opacity .25s ease, transform .25s ease, box-shadow .2s ease;',
        '  pointer-events: none;',
        '}',
        '.fab.ready { opacity: 1; transform: scale(1); pointer-events: auto; }',
        '.fab.ready:hover { transform: scale(1.08); }',
        '.fab:focus { outline: none; }',
        '.fab:focus-visible { outline: 2px solid ' + themeColor + '; outline-offset: 3px; }',
        '@keyframes sb-spin { to { transform: rotate(360deg); } }',
        '.fab > svg { width: 100%; height: 100%; display: block; }',
        '.fab > svg.default-icon { width: 28px; height: 28px; fill: white; }',
        // Cycling typewriter tooltip. iPad-and-larger only (≥768px). Anchored
        // to the FAB's vertical center so the bubble visually aligns with the
        // logo regardless of FAB size.
        '.label {',
        '  position: absolute;',
        '  ' + (isLeft ? 'left: 76px;' : 'right: 76px;'),
        '  top: 50%;',
        '  transform: translateY(-50%) translateY(2px);',
        '  background: white; color: #1e293b;',
        '  padding: 8px 14px; border-radius: 12px;',
        '  font-size: 13px; font-weight: 500; line-height: 1.3;',
        '  box-shadow: 0 4px 16px rgba(15,23,42,.12);',
        '  pointer-events: none; user-select: none;',
        '  white-space: nowrap; max-width: min(80vw, 240px);',
        '  opacity: 0;',
        '  transition: opacity .2s ease, transform .2s ease;',
        '  direction: inherit; z-index: 1;',
        '}',
        '.label.show { opacity: 1; transform: translateY(-50%); }',
        // Side-anchored arrow tail, pinned to the bubble vertical midline.
        '.label::after {',
        '  content: ""; position: absolute;',
        '  top: 50%; ' + (isLeft ? 'right: 100%;' : 'left: 100%;'),
        '  margin-top: -6px;',
        '  border: 6px solid transparent;',
        '  ' + (isLeft ? 'border-right-color: white;' : 'border-left-color: white;'),
        '}',
        '.label .caret {',
        '  display: inline-block; width: 1px; height: 1em;',
        '  background: currentColor; vertical-align: text-bottom;',
        '  margin-left: 2px; animation: sb-caret 1s steps(1) infinite;',
        '}',
        '@keyframes sb-caret { 50% { opacity: 0; } }',
        // While chat is open the tooltip must hide everywhere.
        ':host(.chat-open) .label { display: none; }',
        // Reduced motion: skip the caret blink and the slide-in (but keep
        // the vertical-center transform so the bubble stays aligned).
        '@media (prefers-reduced-motion: reduce) {',
        '  .label { transition: opacity .15s ease; transform: translateY(-50%); }',
        '  .label.show { transform: translateY(-50%); }',
        '  .label .caret { animation: none; opacity: .6; }',
        '}',
        '.iframe-wrap {',
        '  position: fixed; z-index: 2147483646;',
        '  ' + (isLeft ? 'left: 20px;' : 'right: 20px;'),
        '  bottom: 90px; width: 400px; height: 600px;',
        '  max-height: calc(100vh - 120px); max-width: calc(100vw - 40px);',
        '  border-radius: 16px; overflow: hidden;',
        '  box-shadow: 0 12px 48px rgba(0,0,0,.15);',
        '  opacity: 0; transform: translateY(20px) scale(.95);',
        '  transition: opacity .25s ease, transform .25s ease;',
        '  pointer-events: none; display: none;',
        '}',
        '.iframe-wrap.open {',
        '  display: block; opacity: 1; transform: translateY(0) scale(1);',
        '  pointer-events: auto;',
        '}',
        '.iframe-wrap iframe {',
        '  display: block;',
        '  width: 100%; height: 100%; border: none;',
        '  border-radius: 16px; background: transparent;',
        '  color-scheme: light dark;',
        '}',
        '.iframe-loader {',
        '  position: absolute; inset: 0; z-index: 1;',
        '  display: flex; align-items: center; justify-content: center;',
        '  background: Canvas; border-radius: 16px;',
        '  transition: opacity .25s ease;',
        '}',
        '@media (prefers-color-scheme: dark) {',
        '  .iframe-loader { background: #0f172a; }',
        '}',
        '.iframe-loader.hide { opacity: 0; pointer-events: none; }',
        '.iframe-loader .spinner-lg {',
        '  width: 36px; height: 36px; border-radius: 50%;',
        '  border: 3px solid rgba(15,23,42,.12);',
        '  border-top-color: ' + themeColor + ';',
        '  animation: sb-spin .7s linear infinite;',
        '}',
        // Below iPad (≥768px): hide the typewriter tagline entirely.
        '@media (max-width: 767px) {',
        '  .label, .label::after { display: none !important; }',
        '}',
        '@media (max-width: 480px) {',
        '  .iframe-wrap {',
        '    width: 100vw; height: 100dvh; max-height: 100dvh; max-width: 100vw;',
        '    bottom: 0; right: 0; left: 0; top: 0; border-radius: 0;',
        '  }',
        '  .iframe-wrap iframe { border-radius: 0; }',
        '  .fab { width: 56px; height: 56px; }',
        '  :host(.chat-open) .fab { display: none; }',
        '}',
      ].join('\n');
      this.shadow.appendChild(style);

      const fab = document.createElement('button');
      fab.className = 'fab';
      fab.setAttribute('aria-label', 'Open chat');
      // Default chat-bubble icon shown if /api/config never resolves.
      // _applyConfig replaces this with the bot's branded SVG.
      fab.innerHTML =
        '<svg class="default-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>' +
        '</svg>';
      fab.addEventListener('click', () => this._toggle());
      this.shadow.appendChild(fab);
      this._fab = fab;

      // Typewriter tooltip. textNode is what we mutate per-char so we never
      // re-create DOM during the cycle; the caret is a sibling so the blink
      // animation is independent of the text writing.
      const label = document.createElement('div');
      label.className = 'label';
      label.setAttribute('role', 'status');
      label.setAttribute('aria-live', 'polite');
      const textNode = document.createTextNode('');
      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.setAttribute('aria-hidden', 'true');
      label.appendChild(textNode);
      label.appendChild(caret);
      this.shadow.appendChild(label);
      this._label = label;
      this._tipTextNode = textNode;
      this._tipCaret = caret;

      const wrap = document.createElement('div');
      wrap.className = 'iframe-wrap';
      this.shadow.appendChild(wrap);
      this._wrap = wrap;
    }

    _toggle() {
      this._open = !this._open;
      if (this._open) {
        // Tooltip visibility is now driven by :host(.chat-open) .label rule;
        // also stop the cycle so we don't burn timer ticks while chat is open.
        this._dismissTooltip(/*persist*/ true);
        if (!this._iframeLoaded) this._loadIframe();
        this._wrap.classList.add('open');
        this.classList.add('chat-open');
        this._attachViewportTracking();
        this._postToIframe({ type: 'Sapybase:visibility', open: true });
      } else {
        this._wrap.classList.remove('open');
        this.classList.remove('chat-open');
        this._detachViewportTracking();
        this._postToIframe({ type: 'Sapybase:visibility', open: false });
      }
    }

    // Mobile keyboard fix for the iframe-wrap: when the on-screen keyboard
    // opens inside the iframe, iOS Safari shrinks visualViewport but leaves
    // the layout viewport unchanged — so a 100dvh wrap shows the host page
    // between the chat input and the keyboard. Track visualViewport.height +
    // offsetTop while open and pin the wrap to the visible region.
    _attachViewportTracking() {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      var vv = window.visualViewport;
      var wrap = this._wrap;
      if (!wrap) return;
      var sync = function () {
        if (window.matchMedia && !window.matchMedia('(max-width: 480px)').matches) {
          // Desktop / tablet sized wrap doesn't fill the viewport; leave it.
          wrap.style.height = '';
          wrap.style.top = '';
          return;
        }
        wrap.style.height = vv.height + 'px';
        wrap.style.top = vv.offsetTop + 'px';
      };
      this._onVvSync = sync;
      vv.addEventListener('resize', sync);
      vv.addEventListener('scroll', sync);
      sync();
    }

    _detachViewportTracking() {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      var vv = window.visualViewport;
      if (this._onVvSync) {
        vv.removeEventListener('resize', this._onVvSync);
        vv.removeEventListener('scroll', this._onVvSync);
        this._onVvSync = null;
      }
      if (this._wrap) {
        this._wrap.style.height = '';
        this._wrap.style.top = '';
      }
    }

    _loadIframe() {
      // Loading spinner overlay — covers the iframe until the embed page
      // posts 'Sapybase:ready' (after its /api/config fetch + first paint).
      // We don't use the iframe's 'load' event because that fires before
      // React has hydrated the chat UI, leaving a visible flash.
      const loader = document.createElement('div');
      loader.className = 'iframe-loader';
      loader.innerHTML = '<div class="spinner-lg" aria-hidden="true"></div>';
      this._wrap.appendChild(loader);
      this._iframeLoader = loader;

      // Safety: if the embed page never posts ready (network error, very
      // old build), hide the spinner after 8s anyway so users aren't stuck.
      this._iframeLoaderTimer = setTimeout(() => {
        if (this._iframeLoader) this._iframeLoader.classList.add('hide');
      }, 8000);

      const iframe = document.createElement('iframe');
      iframe.src =
        IFRAME_ORIGIN + '/embed/' + this._botId +
        '#parentOrigin=' + encodeURIComponent(window.location.origin);
      iframe.title = 'Sapybase AI Chat';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'clipboard-write';
      // Sandbox: limit iframe blast radius if /embed is ever XSS'd.
      // - allow-scripts: chat UI is React, obviously needs JS.
      // - allow-same-origin: required so the embed page (on www.sapybase.com)
      //   can call /api/chat etc. with normal CORS; without it the iframe
      //   gets an opaque origin and breaks fetch credentialing.
      // - allow-popups + allow-popups-to-escape-sandbox: for target="_blank"
      //   links (brand link, handoff redirect, source citations).
      // - allow-forms: defensive; LeadCaptureForm uses fetch(), not native
      //   form submit, but kept in case future flows add real <form> POSTs.
      iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms';
      this._wrap.appendChild(iframe);
      this._iframe = iframe;
      this._iframeLoaded = true;
    }

    _postToIframe(data) {
      if (this._iframe && this._iframe.contentWindow) {
        this._iframe.contentWindow.postMessage(data, IFRAME_ORIGIN);
      }
    }

    // Fix #5 (loader side): handle Sapybase:resize from embed page + Sapybase:close
    _listenForMessages() {
      window.addEventListener('message', (e) => {
        // Pin to OUR iframe's window and exact origin — no host-page or wildcard fallbacks.
        if (!this._iframe || e.source !== this._iframe.contentWindow) return;
        if (e.origin !== IFRAME_ORIGIN) return;
        const data = e.data;
        if (!data || typeof data !== 'object') return;

        // Sapybase:resize was previously used to dynamically size the wrap to
        // the iframe's content. That created a feedback loop on close (iframe
        // collapses → height: 0 → wrap shrinks → next open is tiny). The wrap
        // size is now controlled entirely by CSS.

        if (data.type === 'Sapybase:close') {
          this._open = false;
          if (this._wrap) this._wrap.classList.remove('open');
          this.classList.remove('chat-open');
          this._detachViewportTracking();
        }

        if (data.type === 'Sapybase:ready' && this._iframeLoader) {
          clearTimeout(this._iframeLoaderTimer);
          this._iframeLoader.classList.add('hide');
        }
      });
    }
  }

  try {
    customElements.define('sapybase-widget', SapybaseWidget);
  } catch (e) {
    // Already defined by another script copy — abort.
    return;
  }

  // Auto-mount from <script data-bot-id="..."> tag.
  // document.currentScript is null when the script is injected dynamically
  // (e.g. Next.js <Script strategy="lazyOnload">), so fall back to a query.
  function autoMount() {
    var currentScript =
      document.currentScript ||
      document.querySelector('script[data-bot-id][src*="sapybase-loader.js"]');
    if (!currentScript) return;

    var botId = currentScript.getAttribute('data-bot-id');
    if (!botId || document.querySelector('sapybase-widget')) return;

    // Some hosts (e.g. AMP, very early defer scripts) may run this before
    // <body> exists. Defer until the body is available.
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', autoMount, { once: true });
      return;
    }

    var el = document.createElement('sapybase-widget');
    el.setAttribute('data-bot-id', botId);
    var pos = currentScript.getAttribute('data-position');
    if (pos) el.setAttribute('data-position', pos);

    try {
      document.body.appendChild(el);
    } catch (e) {
      // SPA frameworks may replace body during hydration; retry once.
      setTimeout(function () {
        try { document.body.appendChild(el); } catch (err) { }
      }, 500);
      return;
    }

    // WP cookie banners / sticky CTAs often share max z-index 2147483647;
    // when z-index ties, last-in-DOM wins. Re-append after load so we sit
    // on top of late-injected overlays.
    var reseat = function () {
      try {
        if (el.parentNode === document.body) document.body.appendChild(el);
      } catch (e) { }
    };
    if (document.readyState === 'complete') setTimeout(reseat, 1500);
    else window.addEventListener('load', function () { setTimeout(reseat, 1500); });
  }

  autoMount();
})();
