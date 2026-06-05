/*!
 * Sapybase / Vaayu embed shim — widget.js
 * ---------------------------------------------------------------------------
 * Backwards-compatible bootstrap for the legacy embed snippet:
 *   <script src="https://sapybase.com/widget.js" data-api-key="..." defer></script>
 *
 * widget.js used to be a self-contained ~670KB React bundle built before the
 * Next.js migration. It had no build pipeline in this repo and could not be
 * regenerated. It is now a thin shim that boots the canonical loader
 * (sapybase-loader.js), which mounts the chat widget via an iframe to
 * /embed/{botId}. Result: every existing customer automatically runs the
 * current Next.js widget with no snippet change on their side — one source of
 * truth (src/app/components/ChatWidget.tsx via the /embed route).
 *
 * botId === apiKey in this system, so we accept data-api-key (legacy),
 * data-bot-id (current), and bot-id (alias).
 */
(function () {
  'use strict';

  // Never run inside our own embed iframe — the embed page already renders the
  // widget; re-running here would nest a second one.
  try {
    if (window.self !== window.top) return;
  } catch (e) {
    return; // cross-origin framed — bail
  }

  if (window.__sapybaseWidgetShimLoaded) return;
  window.__sapybaseWidgetShimLoaded = true;

  // Locate this script tag (currentScript, with query fallbacks for defer /
  // dynamic-injection cases where currentScript can be null).
  var me =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"][data-api-key]') ||
    document.querySelector('script[src*="widget.js"][data-bot-id]');
  if (!me) return;

  var botId =
    me.getAttribute('data-bot-id') ||
    me.getAttribute('bot-id') ||
    me.getAttribute('data-api-key');
  if (!botId) {
    if (window.console && console.error) {
      console.error('[Sapybase] widget.js: missing data-api-key (or data-bot-id) attribute.');
    }
    return;
  }

  // Resolve the canonical loader URL from this script's own origin so it works
  // on prod, localhost, and any preview domain.
  var loaderSrc = '/sapybase-loader.js';
  try {
    if (me.src) loaderSrc = me.src.replace(/widget\.js(\?.*)?(#.*)?$/, 'sapybase-loader.js');
  } catch (e) { /* keep default */ }

  // Avoid double-injecting the loader.
  if (document.querySelector('script[data-bot-id][src*="sapybase-loader.js"]')) return;

  var s = document.createElement('script');
  s.src = loaderSrc;
  s.async = true;
  s.setAttribute('data-bot-id', botId);
  var pos = me.getAttribute('data-position');
  if (pos) s.setAttribute('data-position', pos);
  (document.head || document.documentElement).appendChild(s);
})();
