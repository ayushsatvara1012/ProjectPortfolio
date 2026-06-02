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
    var fallbackId = 'sb-fab-fallback-' + sfx;
    var safeUrl = logoUrl ? String(logoUrl).replace(/"/g, '&quot;') : '';
    var initial = (botName || 'S').charAt(0).toUpperCase();
    var ox = shape.x || 0;
    var oy = shape.y || 0;

    var content = '';
    var fill = isCustom ? 'url(#' + gradId + ')' : '#ffffff';

    if (safeUrl) {
      var ix = isCustom ? ox : 20 + ox;
      var iy = isCustom ? oy : 20 + oy;
      var iw = isCustom ? 100 : 60;
      var ih = isCustom ? 100 : 60;
      // Render both image and fallback text. Image will show if it loads;
      // text will show if image fails. Fallback ID allows image onerror to target it.
      content =
        '<g clip-path="url(#' + clipId + ')">' +
        '<image href="' + safeUrl + '" x="' + ix + '" y="' + iy + '" ' +
        'width="' + iw + '" height="' + ih + '" preserveAspectRatio="xMidYMid meet" ' +
        'onerror="document.getElementById(\'' + fallbackId + '\').style.display=\'block\'" />' +
        '<text id="' + fallbackId + '" x="' + (50 + ox) + '" y="' + (52 + oy) + '" ' +
        'text-anchor="middle" dominant-baseline="middle" fill="#ffffff" ' +
        'style="font-size:38px;font-weight:700;font-family:system-ui,sans-serif;display:none;">' +
        initial + '</text>' +
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
      '<path d="' + shape.path + '" fill="' + fill + '"/>' +
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
      this._revealed = false;
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
      if (this._fabWrap) this._fabWrap.classList.add('ready');
    }

    disconnectedCallback() {
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
      let logoUrl = cfg.custom_logo_url || '/logo2.svg';
      const isCustom = !!cfg.custom_logo_url;
      const botName = cfg.bot_name || 'Sapy AI';

      // Convert relative paths to absolute URLs (e.g. /SB_loading.svg → https://www.sapybase.com/SB_loading.svg)
      if (logoUrl && logoUrl.startsWith('/')) {
        logoUrl = IFRAME_ORIGIN + logoUrl;
      }

      if (this._fab) {
        const dark = _shadeColor(themeColor, -20);

        this._fab.style.borderRadius = '0';
        this._fab.style.background = 'transparent';
        this._fab.style.boxShadow = 'none';
        this._fab.style.padding = '0';
        this._fab.style.overflow = 'visible';
        this._fab.innerHTML = _buildFabSvg(shape, themeColor, dark, logoUrl, isCustom, botName);
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
        '  z-index: var(--sapybase-z, 2147483647);',
        '  ' + (isLeft ? 'left: 20px;' : 'right: 20px;'),
        '  bottom: 20px;',
        '  font-family: system-ui, -apple-system, sans-serif;',
        '}',
        '.fab-wrap {',
        '  position: relative;',
        '  width: 64px; height: 64px;',
        '  display: flex; align-items: center; justify-content: center;',
        '  opacity: 0; transform: scale(.85);',
        '  transition: opacity .25s ease, transform .25s ease;',
        '  pointer-events: none;',
        '}',
        '.fab-wrap.ready { opacity: 1; transform: scale(1); pointer-events: auto; }',
        '.fab {',
        '  width: 64px; height: 64px; border-radius: 50%; cursor: pointer;',
        '  background: transparent; border: none;',
        '  padding: 0; overflow: visible;',
        '  display: flex; align-items: center; justify-content: center;',
        '  position: relative; z-index: 1;',
        '  -webkit-tap-highlight-color: transparent;',
        '  -webkit-touch-callout: none;',
        '  user-select: none; -webkit-user-select: none;',
        '  touch-action: manipulation;',
        '  transition: transform .2s ease;',
        '}',
        '.fab-wrap.ready .fab:hover { transform: scale(1.08); }',
        '.fab:focus { outline: none; }',
        '.fab:focus-visible { outline: 2px solid ' + themeColor + '; outline-offset: 3px; border-radius: 50%; }',
        '@keyframes sb-spin { to { transform: rotate(360deg); } }',
        '.fab > svg { width: 100%; height: 100%; display: block; }',
        '.fab > svg.default-icon { width: 28px; height: 28px; fill: white; }',
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
        '  border-radius: 16px; background: white;',
        '}',
        '.iframe-loader {',
        '  position: absolute; inset: 0; z-index: 1;',
        '  display: flex; align-items: center; justify-content: center;',
        '  background: white; border-radius: 16px;',
        '  transition: opacity .25s ease;',
        '}',
        '.iframe-loader.hide { opacity: 0; pointer-events: none; }',
        '.iframe-loader .spinner-lg {',
        '  width: 36px; height: 36px; border-radius: 50%;',
        '  border: 3px solid rgba(15,23,42,.12);',
        '  border-top-color: ' + themeColor + ';',
        '  animation: sb-spin .7s linear infinite;',
        '}',
        '@media (max-width: 480px) {',
        '  .iframe-wrap {',
        '    width: 100vw; height: 100dvh; max-height: 100dvh; max-width: 100vw;',
        '    bottom: 0; right: 0; left: 0; top: 0; border-radius: 0;',
        '  }',
        '  .iframe-wrap iframe { border-radius: 0; }',
        '  .fab-wrap { width: 56px; height: 56px; }',
        '  .fab { width: 56px; height: 56px; }',
        '  :host(.chat-open) .fab-wrap { display: none; }',
        '}',
      ].join('\n');
      this.shadow.appendChild(style);

      const fabWrap = document.createElement('div');
      fabWrap.className = 'fab-wrap';
      this._fabWrap = fabWrap;

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
      fabWrap.appendChild(fab);
      this.shadow.appendChild(fabWrap);
      this._fab = fab;

      const wrap = document.createElement('div');
      wrap.className = 'iframe-wrap';
      this.shadow.appendChild(wrap);
      this._wrap = wrap;
    }

    _toggle() {
      this._open = !this._open;
      if (this._open) {
        if (!this._iframeLoaded) this._loadIframe();
        this._wrap.classList.add('open');
        this.classList.add('chat-open');
        if (this._fabWrap) this._fabWrap.classList.add('open');
        this._postToIframe({ type: 'Sapybase:visibility', open: true });
      } else {
        this._wrap.classList.remove('open');
        this.classList.remove('chat-open');
        if (this._fabWrap) this._fabWrap.classList.remove('open');
        this._postToIframe({ type: 'Sapybase:visibility', open: false });
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
          if (this._fabWrap) this._fabWrap.classList.remove('open');
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
