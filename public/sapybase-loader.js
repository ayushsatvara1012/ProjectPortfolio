(function () {
  'use strict';

  // Fix #2: double-mount guard — if script is loaded twice, bail out early
  if (customElements.get('sapybase-widget')) return;

  const IFRAME_ORIGIN =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : 'https://www.sapybase.com';

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

      this._render(position);
      this._listenForMessages();
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

    _render(position) {
      const isLeft = position === 'bottom-left';
      const themeColor =
        (window.SapybaseConfig && window.SapybaseConfig.themeColor) || '#5730F5';

      const style = document.createElement('style');
      style.textContent = [
        ':host {',
        '  all: initial;',
        '  position: fixed;',
        '  z-index: 2147483647;',
        '  ' + (isLeft ? 'left: 20px;' : 'right: 20px;'),
        '  bottom: 20px;',
        '  font-family: system-ui, -apple-system, sans-serif;',
        '}',
        '.fab {',
        '  width: 60px; height: 60px; border-radius: 50%; cursor: pointer;',
        '  background: linear-gradient(135deg, ' + themeColor + ', #4f46e5);',
        '  box-shadow: 0 4px 24px rgba(87,48,245,.35); border: none;',
        '  display: flex; align-items: center; justify-content: center;',
        '  transition: transform .2s ease, box-shadow .2s ease;',
        '  pointer-events: auto;',
        '}',
        '.fab:hover { transform: scale(1.08); box-shadow: 0 6px 32px rgba(87,48,245,.45); }',
        '.fab svg { width: 28px; height: 28px; fill: white; }',
        '.label {',
        '  position: absolute; bottom: 70px; ' + (isLeft ? 'left: 0;' : 'right: 0;'),
        '  white-space: nowrap; background: white; color: #1e293b;',
        '  padding: 6px 14px; border-radius: 12px; font-size: 13px; font-weight: 500;',
        '  box-shadow: 0 2px 12px rgba(0,0,0,.1); pointer-events: none;',
        '  opacity: 0; animation: fadeIn .3s ease 2s forwards;',
        '}',
        '@keyframes fadeIn { to { opacity: 1; } }',
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
        '  width: 100%; height: 100%; border: none;',
        '  border-radius: 16px; background: white;',
        '}',
        '@media (max-width: 480px) {',
        '  .iframe-wrap {',
        '    width: 100vw; height: 100vh; max-height: 100vh; max-width: 100vw;',
        '    bottom: 0; right: 0; left: 0; border-radius: 0;',
        '  }',
        '  .fab { width: 52px; height: 52px; }',
        '  .label { display: none; }',
        '}',
      ].join('\n');
      this.shadow.appendChild(style);

      const fab = document.createElement('button');
      fab.className = 'fab';
      fab.setAttribute('aria-label', 'Open chat');
      fab.innerHTML =
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>' +
        '</svg>';
      fab.addEventListener('click', () => this._toggle());
      this.shadow.appendChild(fab);
      this._fab = fab;

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = 'Chat with us!';
      this.shadow.appendChild(label);
      this._label = label;

      const wrap = document.createElement('div');
      wrap.className = 'iframe-wrap';
      this.shadow.appendChild(wrap);
      this._wrap = wrap;
    }

    _toggle() {
      this._open = !this._open;
      if (this._open) {
        this._label.style.display = 'none';
        if (!this._iframeLoaded) this._loadIframe();
        this._wrap.classList.add('open');
        this._postToIframe({ type: 'Sapybase:visibility', open: true });
      } else {
        this._wrap.classList.remove('open');
        this._postToIframe({ type: 'Sapybase:visibility', open: false });
      }
    }

    _loadIframe() {
      const iframe = document.createElement('iframe');
      iframe.src =
        IFRAME_ORIGIN + '/embed/' + this._botId +
        '#parentOrigin=' + encodeURIComponent(window.location.origin);
      iframe.title = 'Sapybase AI Chat';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'clipboard-write';
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

        if (data.type === 'Sapybase:resize' && Number.isFinite(data.height)) {
          if (this._wrap) {
            const safeH = Math.max(200, Math.min(data.height, window.innerHeight - 120, 800));
            this._wrap.style.height = safeH + 'px';
          }
        }

        if (data.type === 'Sapybase:close') {
          this._open = false;
          if (this._wrap) this._wrap.classList.remove('open');
        }
      });
    }
  }

  customElements.define('sapybase-widget', SapybaseWidget);

  // Auto-mount from <script data-bot-id="..."> tag.
  // document.currentScript is null when the script is injected dynamically
  // (e.g. Next.js <Script strategy="lazyOnload">), so fall back to a query.
  var currentScript =
    document.currentScript ||
    document.querySelector('script[data-bot-id][src*="sapybase-loader.js"]');
  if (currentScript) {
    var botId = currentScript.getAttribute('data-bot-id');
    if (botId && !document.querySelector('sapybase-widget')) {
      var el = document.createElement('sapybase-widget');
      el.setAttribute('data-bot-id', botId);
      var pos = currentScript.getAttribute('data-position');
      if (pos) el.setAttribute('data-position', pos);
      document.body.appendChild(el);

      // WP cookie banners / sticky CTAs often share max z-index 2147483647;
      // when z-index ties, last-in-DOM wins. Re-append after load so we sit
      // on top of late-injected overlays.
      var reseat = function () { try { document.body.appendChild(el); } catch (e) { } };
      if (document.readyState === 'complete') setTimeout(reseat, 1500);
      else window.addEventListener('load', function () { setTimeout(reseat, 1500); });
    }
  }
})();
