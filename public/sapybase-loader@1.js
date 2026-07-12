(function () {
  'use strict';

  // Don't run inside our own embed iframe — the embed page already renders
  // the full ChatWidget. Re-running the loader there produces a nested FAB
  // and a duplicate chat panel.
  try {
    if (window.self !== window.top) return;
  } catch {
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
  } catch {
    // Some legacy polyfills throw on .get(); treat as already-defined.
    return;
  }

  let loaderOrigin = 'https://www.sapybase.com';
  try {
    var me =
      document.currentScript ||
      document.querySelector('script[data-bot-id][src*="sapybase-loader@1.js"]');
    if (me && me.src) {
      var url = new URL(me.src);
      loaderOrigin = url.origin;
    } else if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        loaderOrigin = 'http://localhost:3000';
      }
    }
  } catch {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        loaderOrigin = 'http://localhost:3000';
      }
    }
  }
  const IFRAME_ORIGIN = loaderOrigin;

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
    circle: { path: 'M 50 4 C 75.5 4 96 24.5 96 50 C 96 75.5 75.5 96 50 96 C 24.5 96 4 75.5 4 50 C 4 24.5 24.5 4 50 4 Z', x: 0, y: 0 },
    squircle: { path: 'M 22 4 H 78 Q 96 4 96 22 V 62 Q 96 80 78 80 H 36 L 18 96 L 22 80 H 22 Q 4 80 4 62 V 22 Q 4 4 22 4 Z', x: 0, y: -8 },
    bento: { path: 'M39.5 0H60.5A39.5 39.5 0 0160.5 79H46Q40 79 27 90 35 79 32 78A39.5 39.5 0 0139.5 0Z', x: 0, y: -10.5 },
    sharp: { path: 'M50 3C77 3 97 23 97 50 97 77 77 97 50 97 35 97 26 90 26 90L9 97 15 83C6 71 3 61 3 50 3 23 23 3 50 3Z', x: 0, y: 0 },
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
  function _buildFabSvg(shape, themeColor, darkColor, logoUrl, isCustom, botName, hasCustomColor) {
    var sfx = Math.random().toString(36).slice(2, 8);
    var gradId = 'sb-fab-grad-' + sfx;
    var clipId = 'sb-fab-clip-' + sfx;
    var fallbackId = 'sb-fab-fallback-' + sfx;
    var safeUrl = logoUrl ? String(logoUrl).replace(/"/g, '&quot;') : '';
    var initial = (botName || 'S').charAt(0).toUpperCase();
    var ox = shape.x || 0;
    var oy = shape.y || 0;

    var content = '';
    var fill = (isCustom || hasCustomColor) ? 'url(#' + gradId + ')' : '#000d42';

    if (isCustom) {
      if (safeUrl) {
        var ix = ox;
        var iy = oy;
        var iw = 100;
        var ih = 100;
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
    } else {
      // Default logo - render using the new inline SVG
      content = '<g clip-path="url(#' + clipId + ')">' +
        '<svg x="' + (20 + ox) + '" y="' + (25 + oy) + '" width="60" height="50" viewBox="0 0 18 15" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill-rule="evenodd" clip-rule="evenodd" d="M6.75367 0.0681719C6.37057 0.0688596 5.94592 0.0424427 5.56448 0.00672022C5.52547 0.00306659 5.48551 0.00116674 5.44463 0.00112716L4.21752 3.58511e-07C3.77453 -0.000343249 3.38837 0.246336 3.18853 0.608474L3.18156 0.621996L3.17459 0.636081L0.198914 6.79967C-0.0846151 7.38695 -0.0640101 8.07559 0.254125 8.64487L3.46684 14.3938C3.66693 14.7544 4.05195 15 4.4935 15H7.60357C7.67759 15 7.72393 14.92 7.68708 14.8558C7.65023 14.7916 7.69657 14.7115 7.77059 14.7115H8.09447C8.19628 14.7115 8.29066 14.7667 8.34121 14.8551C8.39224 14.9443 8.48751 15 8.59026 15H10.5204C10.938 14.9999 11.4095 14.9984 11.8271 14.9989L13.0537 15C13.4977 15.0003 13.8844 14.7526 14.0838 14.3893L17.2134 8.68669C17.5451 8.08233 17.5421 7.34975 17.2056 6.74809L13.8043 0.667631C13.6037 0.308959 13.2199 0.0654264 12.78 0.0653549H9.72023C9.6462 0.0653549 9.59937 0.144831 9.63524 0.209586C9.67111 0.274341 9.62427 0.353816 9.55025 0.353816H9.19478C9.09277 0.353816 8.99876 0.298563 8.94913 0.209436C8.89942 0.120169 8.8052 0.0648928 8.70302 0.0650561L6.75367 0.0681719ZM12.78 0.642278L12.8561 0.647349C13.0324 0.671732 13.1902 0.779635 13.2814 0.942571L16.5304 6.75086C16.867 7.35255 16.8699 8.08516 16.5382 8.68953L13.5586 14.1183L13.5156 14.1853C13.4065 14.3341 13.2365 14.4232 13.0543 14.4231L11.8277 14.422C11.3823 14.4213 11.1033 13.9186 11.324 13.5143L13.9531 8.6966C14.2812 8.09534 14.2788 7.36797 13.9468 6.76889L11.6315 2.59212C11.1463 1.71686 11.7793 0.642278 12.78 0.642278ZM3.71319 0.880597C3.81698 0.692529 4.00918 0.576803 4.21694 0.576923L5.44405 0.57805L5.52539 0.583684C5.92243 0.64066 6.1546 1.10651 5.94779 1.48569C5.39448 2.49969 4.95554 3.46115 4.50577 4.44631C4.1697 5.18246 3.82758 5.93184 3.42719 6.72625C3.11407 7.3475 3.11849 8.08578 3.46494 8.68907L5.63018 12.4596C6.13198 13.3334 5.50118 14.4231 4.4935 14.4231C4.28638 14.4231 4.09481 14.3078 3.99092 14.1205L0.920057 8.62628C0.601871 8.057 0.581234 7.36834 0.86476 6.78102L3.71319 0.880597ZM6.25283 1.55668C6.02875 1.15244 6.30775 0.645897 6.75483 0.645095L7.33651 0.644164C8.06329 0.643 8.7335 1.0362 9.08708 1.67118L11.8719 6.67236L11.9085 6.74899C12.0516 7.11225 11.8243 7.52491 11.4518 7.57831L11.3699 7.58451H9.92894L9.85225 7.57888C9.67535 7.55422 9.51724 7.44535 9.42636 7.2814L6.25283 1.55668ZM12.3954 6.39799C12.7992 7.12327 12.341 8.16143 11.3699 8.16143H9.92894C9.48723 8.16137 9.10227 7.91544 8.90228 7.55465L7.27538 4.61929C6.77133 3.70985 5.47726 3.74415 5.04533 4.68997L5.01584 4.75455C4.72652 5.38802 4.42759 6.03845 4.08854 6.723C3.78259 7.34027 3.79081 8.0707 4.13389 8.66813L7.19101 13.9917C7.24179 14.0801 7.33598 14.1346 7.43795 14.1346C7.65669 14.1346 7.79375 13.8982 7.68508 13.7084L4.78459 8.64145C4.36958 7.91634 4.82525 6.86632 5.80312 6.86617H7.35444C7.79802 6.86623 8.18414 7.11393 8.38343 7.4769L9.41424 9.35421C10.1749 10.7395 12.1661 10.7368 12.923 9.34953L13.2787 8.69769C13.6067 8.09644 13.6043 7.36914 13.272 6.7701L10.1206 1.08468C10.0679 0.989681 9.96788 0.93074 9.85926 0.93074C9.63128 0.93074 9.48727 1.17576 9.59819 1.37494L12.3954 6.39799ZM5.30461 8.36144C5.11397 8.02819 5.26971 7.6206 5.58269 7.48731C5.67064 7.44985 5.7686 7.44872 5.86419 7.44868L7.43172 7.44817C7.60923 7.47308 7.76762 7.58295 7.85819 7.7479L11.0242 13.5143C11.2323 13.8937 10.9995 14.3606 10.6018 14.4174L10.5204 14.4231H9.9341C9.21692 14.4231 8.55464 14.0391 8.19836 13.4167L5.30461 8.36144Z" fill="white"/>' +
        '<path d="M5.44481 0.000976755C5.48563 0.00102169 5.52597 0.00318782 5.56493 0.00683613C5.94615 0.0425288 6.37052 0.0690343 6.7534 0.0683596L8.70262 0.0654299C8.8046 0.0652669 8.89893 0.120022 8.94871 0.208985C8.99834 0.298111 9.09279 0.353516 9.19481 0.353516H9.55028C9.60566 0.3535 9.64627 0.309304 9.64793 0.259766L9.62254 0.160156C9.62383 0.110319 9.66453 0.0654437 9.7202 0.0654299H12.7798C13.2197 0.0655014 13.6035 0.309297 13.8042 0.667969L17.2055 6.74805C17.5421 7.34967 17.545 8.08218 17.2134 8.68652L14.0835 14.3896C13.884 14.7527 13.497 15.0003 13.0532 15L11.8276 14.999C11.41 14.9985 10.9376 14.9999 10.52 15H8.59032C8.48768 15 8.39236 14.9445 8.34129 14.8555C8.29074 14.7671 8.19603 14.7119 8.09422 14.7119H7.77098C7.71565 14.7119 7.67551 14.7563 7.6743 14.8057L7.69969 14.9053C7.69879 14.9548 7.65932 14.9998 7.60399 15H4.49364C4.05209 15 3.66736 14.7541 3.46727 14.3936L0.254378 8.64453C-0.0636446 8.07534 -0.0846964 7.387 0.198714 6.7998L3.1743 0.635742L3.18114 0.62207L3.18895 0.608399C3.38879 0.246456 3.77448 -0.000251846 4.21727 1.92935e-07L5.44481 0.000976755ZM4.21727 0.577149C4.00951 0.577028 3.81715 0.692792 3.71336 0.88086L0.86473 6.78125C0.581318 7.36849 0.602292 8.05677 0.920394 8.62598L3.99071 14.1201C4.0946 14.3073 4.28651 14.4228 4.49364 14.4229C5.50109 14.4229 6.13175 13.3337 5.63035 12.46L3.46532 8.68945C3.11891 8.08623 3.11423 7.34777 3.42723 6.72656C3.8276 5.93219 4.1693 5.18239 4.50535 4.44629C4.95512 3.46113 5.39442 2.49935 5.94774 1.48535C6.15423 1.10638 5.92251 0.641271 5.52586 0.583985L5.44383 0.578125L4.21727 0.577149ZM5.86375 7.44824C5.7683 7.44828 5.67032 7.4499 5.5825 7.4873C5.26971 7.62063 5.11381 8.02818 5.30418 8.36133L8.19871 13.417C8.55505 14.0392 9.21706 14.4228 9.93407 14.4229H10.52L10.602 14.417C10.9996 14.36 11.2318 13.8939 11.0239 13.5146L7.85789 7.74805C7.76739 7.58323 7.60946 7.47326 7.43211 7.44824H5.86375ZM12.7798 0.642578C11.7793 0.642749 11.1465 1.71666 11.6313 2.5918L13.9468 6.76855C14.2788 7.36749 14.2815 8.09511 13.9536 8.69629L11.3237 13.5146C11.1035 13.9189 11.3824 14.4212 11.8276 14.4219L13.0542 14.4229C13.2362 14.4229 13.406 14.3341 13.5151 14.1855L13.5581 14.1182L16.5386 8.68945C16.8701 8.0852 16.8671 7.35255 16.5307 6.75098L13.2817 0.942383C13.1905 0.779456 13.0322 0.671844 12.8559 0.647461L12.7798 0.642578ZM9.85887 0.930664C9.63112 0.93094 9.48728 1.17594 9.59813 1.375L12.395 6.39844C12.7987 7.12371 12.3407 8.16113 11.3696 8.16113H9.92918C9.48747 8.16106 9.10183 7.91548 8.90184 7.55469L7.27489 4.61914C6.77071 3.71003 5.47728 3.74472 5.04539 4.69043L5.0161 4.75488C4.72683 5.38824 4.42759 6.03825 4.08836 6.72266C3.78259 7.33992 3.79118 8.07054 4.13426 8.66797L7.1909 13.9912C7.24168 14.0796 7.336 14.1348 7.43797 14.1348C7.6567 14.1347 7.79371 13.8978 7.68504 13.708L4.78465 8.6416C4.36964 7.91649 4.82534 6.86636 5.80321 6.86621H7.35399C7.79743 6.86627 8.18394 7.11376 8.38328 7.47656L9.41453 9.35449C10.1753 10.7394 12.1664 10.7368 12.9233 9.34961L13.2788 8.69727C13.6067 8.09616 13.6043 7.36938 13.272 6.77051L10.1206 1.08496C10.0679 0.98996 9.96749 0.930664 9.85887 0.930664ZM11.3462 11.3848C11.2297 11.3916 11.1131 11.3922 10.9966 11.3857L11.1714 11.7051L11.3462 11.3848ZM6.75438 0.645508C6.30763 0.646651 6.02863 1.15257 6.25243 1.55664L9.42625 7.28125C9.5171 7.44514 9.67521 7.55439 9.85203 7.5791L9.92918 7.58496H11.3696L11.4516 7.57812C11.8241 7.52473 12.0517 7.11226 11.9087 6.74902L11.8716 6.67285L9.08739 1.6709C8.7338 1.03596 8.06316 0.643368 7.33641 0.644531L6.75438 0.645508Z" fill="white"/>' +
        '</svg>' +
        '</g>';
    }

    var crossSvg = '<g class="sb-fab-cross" style="opacity: 0; transition: opacity 0.3s ease-in-out; transform-origin: center; transform: translate(33px, 33px);">' +
      '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M19.1967 4.13783C19.3805 3.95406 19.6784 3.95406 19.8622 4.13783C20.0459 4.32161 20.0459 4.6195 19.8622 4.80328L12.6654 12L19.8622 19.1967C20.0459 19.3805 20.0459 19.6784 19.8622 19.8622C19.6784 20.0459 19.3805 20.0459 19.1967 19.8622L12 12.6654L4.80328 19.8622C4.6195 20.0459 4.32161 20.0459 4.13783 19.8622C3.95406 19.6784 3.95406 19.3805 4.13783 19.1967L11.3346 12L4.13783 4.80328C3.95406 4.6195 3.95406 4.32161 4.13783 4.13783C4.32161 3.95406 4.6195 3.95406 4.80328 4.13783L12 11.3346L19.1967 4.13783Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg></g>';

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
      '<g class="sb-fab-logo" style="opacity: 1; transition: opacity 0.3s ease-in-out; transform-origin: center;">' + content + '</g>' +
      crossSvg +
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

  // ── Contextual teaser matcher (Phase 2) ─────────────────────────────────────
  // Pure ES5, no DOM/closure deps, so it is unit-tested directly by extracting
  // this delimited block (src/__tests__/teaser-match.test.js). Precedence:
  // explicit page tag (SapybaseConfig.page) → URL rule (first match) → null
  // (caller falls back to the default teaser). Kept in sync with the backend
  // sanitizer services/teaser.py (leading-slash, segment-aware substring).
  // TEASER-MATCHER-START
  function normalizeTeaserPath(loc) {
    // loc: a Location-like { pathname, search, hash } or a raw URL string.
    var pathname = '', hash = '';
    if (loc && typeof loc === 'object') {
      pathname = loc.pathname || '';
      hash = loc.hash || '';
    } else if (typeof loc === 'string') {
      var s = loc.split('#'); hash = s[1] ? '#' + s[1] : '';
      pathname = s[0].split('?')[0];
    }
    // Hash-router paths ("#/products") describe the real page — prefer them.
    var path;
    if (hash && hash.indexOf('#/') === 0) {
      path = hash.slice(1);
    } else {
      path = pathname || '/';
    }
    path = path.split('?')[0].split('#')[0].toLowerCase();
    if (!path) path = '/';
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path.length > 1) path = '/' + path.replace(/^\/+|\/+$/g, '');
    return path;
  }

  function teaserRuleMatchesPath(rule, path) {
    var m = rule && typeof rule.match === 'string' ? rule.match : '';
    if (!m) return false;
    // Segment-aware substring: the match must land on a "/"-or-end boundary. m's
    // own leading slash guards the left edge ("/products" ∌ "/myproducts"); this
    // guards the right edge ("/products" ∌ "/productsxyz") while still firing on
    // "/en/products" (locale prefix) and "/products/123" (sub-path).
    var idx = path.indexOf(m);
    while (idx !== -1) {
      var after = path.charAt(idx + m.length);
      if (after === '' || after === '/') return true;
      idx = path.indexOf(m, idx + 1);
    }
    return false;
  }

  function matchTeaserRule(rules, loc, pageHint) {
    if (!rules || !rules.length) return null;
    var i, r;
    // 1. Explicit page tag wins regardless of URL.
    if (pageHint) {
      var hint = String(pageHint).toLowerCase();
      for (i = 0; i < rules.length; i++) {
        r = rules[i];
        if (r && r.page && String(r.page).toLowerCase() === hint) return r;
      }
    }
    // 2. First URL rule that matches the normalized path.
    var path = normalizeTeaserPath(loc);
    for (i = 0; i < rules.length; i++) {
      r = rules[i];
      if (teaserRuleMatchesPath(r, path)) return r;
    }
    return null;
  }
  // TEASER-MATCHER-END

  // Floating-panel geometry (desktop). The widget switches to fullscreen when
  // the viewport can no longer hold this box plus breathing room — so the
  // "mobile" threshold is DERIVED from the panel size, not a hardcoded pixel
  // breakpoint. Change the box and the switch point follows automatically.
  var PANEL = { width: 420, height: 650, gutter: 16 };
  // Widest viewport that still can't comfortably float the panel → below this
  // we go fullscreen. gutter on both sides + the panel's own width.
  var FULLSCREEN_MAX_W = PANEL.width + PANEL.gutter * 3; // 468
  // Same idea for height: a short (e.g. landscape-phone) viewport that can't
  // fit the panel goes fullscreen too, so the keyboard logic still engages.
  var FULLSCREEN_MAX_H = Math.round(PANEL.height * 0.72); // ~468
  // Single source of truth for the media query, shared by the injected CSS and
  // the JS viewport tracking so the two can never drift out of sync.
  var FULLSCREEN_MQ =
    '(max-width: ' + FULLSCREEN_MAX_W + 'px), (max-height: ' + FULLSCREEN_MAX_H + 'px)';

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
      // Contextual teaser (Phase 1) state
      this._teaser = null;
      this._teaserTimer = null;
      this._teaserPendingRuleId = null;
      this._teaserMem = {};
      // Contextual teaser (Phase 2) — page-aware rules
      this._teaserCfg = null;
      this._teaserRules = null;
      this._teaserActiveRuleId = 'default';
      this._teaserSpaBound = false;
      this._onTeaserRoute = null;
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
      } catch {
        return Promise.resolve(null);
      }
    }

    _applyConfig(cfg) {
      const themeColor = cfg.theme_color || '#004DE8';
      const hasCustomColor = !!cfg.theme_color && cfg.theme_color !== '#004DE8' && cfg.theme_color !== '#5730F5' && cfg.theme_color !== '#000d42';
      const shapeId = cfg.logo_shape || 'circle';
      const shape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
      let logoUrl = cfg.custom_logo_url || '/logo2.svg';
      const isCustom = !!cfg.custom_logo_url;
      const botName = cfg.bot_name || 'Sapy AI';

      // Convert relative paths to absolute URLs (e.g. /SB_loading.svg → https://www.sapybase.com/SB_loading.svg)
      if (logoUrl && logoUrl.startsWith('/')) {
        logoUrl = ASSET_BASE + logoUrl;
      }

      if (this._fab) {
        const dark = _shadeColor(themeColor, -20);

        this._fab.style.borderRadius = '0';
        this._fab.style.background = 'transparent';
        this._fab.style.boxShadow = 'none';
        this._fab.style.padding = '0';
        this._fab.style.overflow = 'visible';
        this._fab.innerHTML = _buildFabSvg(shape, themeColor, dark, logoUrl, isCustom, botName, hasCustomColor);
      }

      // Contextual teaser (Phase 1): schedule the launcher bubble from the
      // same config payload.
      this._maybeScheduleTeaser(cfg);
    }

    // ── Contextual teaser (Phase 1) ──────────────────────────────────────────
    // The bubble lives HERE (host-page shadow DOM), not in ChatWidget: the
    // iframe is display:none while closed and cannot see the host URL. See
    // docs/contextual-teaser-plan.md.

    // Storage: sessionStorage only — a NEW browser session (new tab, or the
    // same tab after the browser was fully closed and reopened) always
    // starts fresh. Two independent per-bot flags, both session-scoped:
    //  - "chat": set the moment the visitor opens the chat — an engaged
    //    visitor is never nagged again, on ANY page, for the rest of this
    //    session.
    //  - "off:<ruleId>": set when that SPECIFIC teaser (page/rule) is
    //    dismissed via ✕ or Esc — only silences that page's message; a
    //    different page (a different rule, or the default) is still
    //    eligible to show, with its own delay.
    // First-party host-site storage; Safari private mode / consent gating
    // may throw, so every access falls back to an in-memory map (degrades to
    // "resets on the next full page load").
    _teaserFlagGet(kind) {
      var key = 'sb-teaser-' + kind + ':' + this._botId;
      if (this._teaserMem[key]) return true;
      try {
        return window.sessionStorage.getItem(key) === '1';
      } catch {
        return false;
      }
    }

    _teaserFlagSet(kind) {
      var key = 'sb-teaser-' + kind + ':' + this._botId;
      this._teaserMem[key] = true;
      try {
        window.sessionStorage.setItem(key, '1');
      } catch { /* in-memory fallback already recorded */ }
    }

    _maybeScheduleTeaser(cfg) {
      var t = cfg && cfg.teaser;
      if (!t || t.enabled === false) return;
      var title = typeof t.title === 'string' ? t.title.trim() : '';
      var rules = (t.rules && t.rules.length) ? t.rules : null;
      if (!title && !rules) return;
      this._teaserCfg = t;
      this._teaserRules = rules || [];
      // Re-evaluate the page rule on SPA route changes for as long as the
      // visitor hasn't opened the chat this session.
      this._bindTeaserSpa();
      this._tryShowTeaserForCurrentPage();
    }

    _cancelPendingTeaserTimer() {
      if (this._teaserTimer) {
        clearTimeout(this._teaserTimer);
        this._teaserTimer = null;
      }
      this._teaserPendingRuleId = null;
    }

    // The single decision point for "should a teaser appear right now" — run
    // on initial load AND on every SPA route change (_onTeaserRouteChange).
    // A page whose rule was already dismissed this session stays silent; a
    // page whose rule was never dismissed gets its own fresh delay, even if
    // a DIFFERENT rule was dismissed on an earlier page this same session.
    _tryShowTeaserForCurrentPage() {
      if (this._open) { this._cancelPendingTeaserTimer(); return; }
      if (this._teaserFlagGet('chat')) { this._cancelPendingTeaserTimer(); return; } // engaged this session

      var resolved = this._resolveTeaser(this._teaserCfg || {});
      if (!resolved.title || !resolved.title.trim()) { this._cancelPendingTeaserTimer(); return; }

      if (this._teaser) {
        // Already visible — swap the copy in place if the page/rule changed;
        // no re-delay and no re-fired impression for the SAME bubble.
        if (resolved.ruleId !== this._teaserActiveRuleId) {
          this._teaserActiveRuleId = resolved.ruleId;
          this._updateTeaserText(resolved);
        }
        return;
      }

      if (this._teaserFlagGet('off:' + resolved.ruleId)) { this._cancelPendingTeaserTimer(); return; } // dismissed on this page before
      if (this._teaserTimer && this._teaserPendingRuleId === resolved.ruleId) return; // already counting down for this page

      this._cancelPendingTeaserTimer();
      this._teaserPendingRuleId = resolved.ruleId;
      var t = this._teaserCfg;
      var delay = typeof t.delay_ms === 'number' && isFinite(t.delay_ms)
        ? Math.min(Math.max(t.delay_ms, 1000), 60000)
        : 5000;
      var self = this;
      this._teaserTimer = setTimeout(function () {
        self._teaserTimer = null;
        self._teaserPendingRuleId = null;
        self._showTeaser(t);
      }, delay);
    }

    // Chat opened (FAB or teaser-card click): full suppression, every page,
    // rest of this session — an engaged visitor is never nagged again.
    _engageTeaser() {
      this._cancelPendingTeaserTimer();
      this._removeTeaser();
      this._unbindTeaserSpa();
      this._teaserFlagSet('chat');
    }

    // Visitor explicitly closed THIS teaser (✕ or Esc): only silences the
    // rule that was showing. A different page's rule (or the default) can
    // still appear later this session; the SPA listener stays bound so a
    // later route change gets a fresh chance.
    _dismissTeaser(ruleId) {
      this._cancelPendingTeaserTimer();
      this._removeTeaser();
      this._teaserFlagSet('off:' + (ruleId || 'default'));
    }

    _removeTeaser() {
      var el = this._teaser;
      this._teaserTitleLine = null;
      this._teaserSubLine = null;
      this._teaserBody = null;
      if (!el) return;
      this._teaser = null;
      el.classList.remove('show');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 250);
    }

    // ── Contextual teaser SPA re-evaluation (Phase 2) ───────────────────────────
    // Host SPAs change route without a full reload. While the bubble is up we
    // re-run the URL matcher and swap the copy in place. We patch history once so
    // pushState/replaceState navigations (which don't fire popstate) are caught.
    _bindTeaserSpa() {
      if (this._teaserSpaBound) return;
      this._teaserSpaBound = true;
      var self = this;
      this._onTeaserRoute = function () { self._onTeaserRouteChange(); };
      try {
        window.addEventListener('popstate', this._onTeaserRoute);
        window.addEventListener('hashchange', this._onTeaserRoute);
        if (!history.__sbTeaserPatched) {
          history.__sbTeaserPatched = true;
          ['pushState', 'replaceState'].forEach(function (name) {
            var orig = history[name];
            if (typeof orig !== 'function') return;
            history[name] = function () {
              var ret = orig.apply(this, arguments);
              try { window.dispatchEvent(new Event('sb:locationchange')); } catch { /* noop */ }
              return ret;
            };
          });
        }
        window.addEventListener('sb:locationchange', this._onTeaserRoute);
      } catch { /* noop */ }
    }

    _unbindTeaserSpa() {
      if (!this._teaserSpaBound || !this._onTeaserRoute) return;
      this._teaserSpaBound = false;
      try {
        window.removeEventListener('popstate', this._onTeaserRoute);
        window.removeEventListener('hashchange', this._onTeaserRoute);
        window.removeEventListener('sb:locationchange', this._onTeaserRoute);
      } catch { /* noop */ }
      this._onTeaserRoute = null;
    }

    _onTeaserRouteChange() {
      // A new page may have a rule that was never dismissed this session,
      // even if the previous page's was — re-run the full decision, not just
      // an in-place text swap (that's still handled inside, when a bubble is
      // already up).
      this._tryShowTeaserForCurrentPage();
    }

    _resetTeaserLine(line) {
      if (!line) return;
      line.classList.remove('sb-teaser-clip', 'sb-teaser-fade');
      var inner = line.firstChild;
      if (inner && typeof inner.getAnimations === 'function') {
        try {
          inner.getAnimations().forEach(function (a) { a.cancel(); });
        } catch { /* noop */ }
      }
      if (inner) inner.style.transform = '';
    }

    // Swap the copy of a live bubble in place (SPA route change) without re-firing
    // the impression event or re-animating the pop-in.
    _updateTeaserText(resolved) {
      var titleLine = this._teaserTitleLine;
      if (!titleLine || !titleLine.firstChild) return;
      var self = this;
      this._resetTeaserLine(titleLine);
      titleLine.firstChild.textContent = resolved.title;
      var sub = typeof resolved.subtext === 'string' ? resolved.subtext.trim() : '';
      if (sub) {
        if (!this._teaserSubLine) {
          var subLine = document.createElement('div');
          subLine.className = 'sb-teaser-line sb-teaser-sub';
          var subInner = document.createElement('span');
          subInner.className = 'sb-teaser-line-inner';
          subLine.appendChild(subInner);
          if (this._teaserBody) this._teaserBody.appendChild(subLine);
          this._teaserSubLine = subLine;
        } else {
          this._resetTeaserLine(this._teaserSubLine);
        }
        this._teaserSubLine.firstChild.textContent = sub;
      } else if (this._teaserSubLine) {
        if (this._teaserSubLine.parentNode) {
          this._teaserSubLine.parentNode.removeChild(this._teaserSubLine);
        }
        this._teaserSubLine = null;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          self._teaserAutoScroll(titleLine);
          if (self._teaserSubLine) self._teaserAutoScroll(self._teaserSubLine);
        });
      });
    }

    // Resolve the copy to show RIGHT NOW: page-tag → URL rule → default teaser.
    // Returns { title, subtext, ruleId }; ruleId feeds analytics ("default" or
    // the matched rule's id). Never throws — a bad rule degrades to the default.
    _resolveTeaser(t) {
      var rule = null;
      try {
        var hint = window.SapybaseConfig && window.SapybaseConfig.page;
        rule = matchTeaserRule(this._teaserRules, window.location, hint);
      } catch { rule = null; }
      if (rule && rule.title) {
        return {
          title: rule.title,
          subtext: typeof rule.subtext === 'string' ? rule.subtext : '',
          ruleId: rule.id || 'rule',
        };
      }
      return {
        title: t && typeof t.title === 'string' ? t.title : '',
        subtext: t && typeof t.subtext === 'string' ? t.subtext : '',
        ruleId: 'default',
      };
    }

    _showTeaser(t) {
      if (this._open || this._teaser || !this._fabWrap) return;
      var self = this;

      var resolved = this._resolveTeaser(t);
      if (!resolved.title || !resolved.title.trim()) return;
      this._teaserActiveRuleId = resolved.ruleId;

      var card = document.createElement('div');
      card.className = 'sb-teaser';
      // Non-modal invite: focusable + activatable, but focus is never stolen.
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Open chat: ' + resolved.title);
      try {
        var dir = document.documentElement.getAttribute('dir');
        if (dir) card.setAttribute('dir', dir);
      } catch { /* noop */ }

      var x = document.createElement('button');
      x.className = 'sb-teaser-x';
      x.type = 'button';
      x.setAttribute('aria-label', 'Dismiss message');
      x.textContent = '✕';

      // SECURITY: teaser copy is owner-authored text — always injected via
      // textContent, never interpolated into an HTML string.
      var body = document.createElement('div');
      body.className = 'sb-teaser-body';
      body.setAttribute('role', 'status'); // polite live region, never assertive
      var titleLine = document.createElement('div');
      titleLine.className = 'sb-teaser-line sb-teaser-title';
      var titleInner = document.createElement('span');
      titleInner.className = 'sb-teaser-line-inner';
      titleInner.textContent = resolved.title;
      titleLine.appendChild(titleInner);
      body.appendChild(titleLine);
      var subLine = null;
      var subtext = typeof resolved.subtext === 'string' ? resolved.subtext.trim() : '';
      if (subtext) {
        subLine = document.createElement('div');
        subLine.className = 'sb-teaser-line sb-teaser-sub';
        var subInner = document.createElement('span');
        subInner.className = 'sb-teaser-line-inner';
        subInner.textContent = subtext;
        subLine.appendChild(subInner);
        body.appendChild(subLine);
      }

      card.appendChild(x);
      card.appendChild(body);
      // Refs for in-place copy swap on SPA route change (Phase 2).
      this._teaserBody = body;
      this._teaserTitleLine = titleLine;
      this._teaserSubLine = subLine;

      var openChat = function () {
        self._teaserEvent('click');
        self._engageTeaser();
        if (!self._open) self._toggle();
      };
      card.addEventListener('click', function (e) {
        if (e.target === x || x.contains(e.target)) return;
        openChat();
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          e.stopPropagation();
          self._teaserEvent('dismiss');
          self._dismissTeaser(self._teaserActiveRuleId);
        } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          openChat();
        }
      });
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        self._teaserEvent('dismiss');
        self._dismissTeaser(self._teaserActiveRuleId);
      });

      this._fabWrap.appendChild(card);
      this._teaser = card;
      this._teaserEvent('impression');

      // Reveal + measure overflow after layout has settled.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          card.classList.add('show');
          self._teaserAutoScroll(titleLine);
          if (subLine) self._teaserAutoScroll(subLine);
        });
      });
    }

    // Overflow behavior (decided 2026-07-11): a line wider than its container
    // ping-pong auto-scrolls (slide, pause, slide back) via the Web Animations
    // API. Only engages on REAL overflow — desktop card lines wrap, so this
    // effectively applies to the mobile pill's nowrap title. Reduced motion
    // (or no WAAPI) falls back to a static ellipsis.
    _teaserAutoScroll(line) {
      if (!line || !line.firstChild) return;
      var inner = line.firstChild;
      var overflow = inner.scrollWidth - line.clientWidth;
      if (overflow <= 4) return;
      var reduced = false;
      try {
        reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch { /* noop */ }
      if (reduced || typeof inner.animate !== 'function') {
        line.classList.add('sb-teaser-clip');
        return;
      }
      line.classList.add('sb-teaser-fade');
      // Gentle: travel time scales with how far the text has to move.
      var travel = 2000 + overflow * 35;
      inner.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: 0.1 },
          { transform: 'translateX(' + -overflow + 'px)', offset: 0.45 },
          { transform: 'translateX(' + -overflow + 'px)', offset: 0.6 },
          { transform: 'translateX(0)', offset: 0.95 },
          { transform: 'translateX(0)', offset: 1 },
        ],
        { duration: travel * 2, iterations: Infinity }
      );
    }

    // Fire-and-forget analytics beacon (impression / dismiss / click).
    // fetch+keepalive instead of sendBeacon because the endpoint authenticates
    // via the x-api-key header. Failures are swallowed — analytics must never
    // affect the host page.
    _teaserEvent(name) {
      try {
        fetch(IFRAME_ORIGIN + '/api/widget/teaser-event', {
          method: 'POST',
          keepalive: true,
          headers: {
            'content-type': 'application/json',
            'x-api-key': this._botId,
            'x-Sapybase-parent-origin': window.location.origin,
          },
          body: JSON.stringify({ event: name, rule_id: this._teaserActiveRuleId || 'default' }),
        }).catch(function () { /* noop */ });
      } catch { /* noop */ }
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
      } catch { /* noop */ }
    }

    _render(position, cfg) {
      const isLeft = position === 'bottom-left';
      const themeColor =
        (cfg && cfg.theme_color) ||
        (window.SapybaseConfig && window.SapybaseConfig.themeColor) ||
        '#004DE8';

      const style = document.createElement('style');
      style.textContent = [
        ':host {',
        '  all: initial;',
        '  position: fixed;',
        '  z-index: var(--sapybase-z, 2147483647);',
        '  ' + (isLeft ? 'left: 16px;' : 'right: 16px;'),
        '  bottom: 16px;',
        '  font-family: system-ui, -apple-system, sans-serif;',
        '}',
        '.fab-wrap {',
        '  position: relative;',
        '  width: 56px; height: 56px;',
        '  display: flex; align-items: center; justify-content: center;',
        '  opacity: 0; transform: scale(.85);',
        '  transition: opacity .25s ease, transform .25s ease;',
        '  pointer-events: none;',
        '}',
        '.fab-wrap.ready { opacity: 1; transform: scale(1); pointer-events: auto; }',
        '.fab {',
        '  width: 56px; height: 56px; border-radius: 50%; cursor: pointer;',
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
        ':host(.chat-open) .sb-fab-logo { opacity: 0 !important; }',
        ':host(.chat-open) .sb-fab-cross { opacity: 1 !important; }',
        '@keyframes sb-spin { to { transform: rotate(360deg); } }',
        '.fab > svg { width: 100%; height: 100%; display: block; }',
        '.fab > svg.default-icon { width: 28px; height: 28px; fill: white; }',
        '.iframe-wrap {',
        '  position: fixed; z-index: 2147483646;',
        '  ' + (isLeft ? 'left: 16px;' : 'right: 16px;'),
        '  bottom: 80px; width: ' + PANEL.width + 'px; height: ' + PANEL.height + 'px;',
        '  max-height: calc(100vh - 110px); max-width: calc(100vw - 40px);',
        '  border-radius: 16px; overflow: hidden;',
        '  box-shadow: 0 12px 48px rgba(0,0,0,.15);',
        '  opacity: 0; transform: translateY(20px) scale(.95);',
        '  transition: opacity .1s ease, transform .1s ease, width .2s ease-in-out, height .2s ease-in-out;',
        '  pointer-events: none; display: none;',
        '}',
        '.iframe-wrap.open {',
        '  display: block; opacity: 1; transform: translateY(0) scale(1);',
        '  pointer-events: auto;',
        '}',
        // While the on-screen keyboard is being tracked (mobile fullscreen),
        // suppress the width/height transition below. Without this, every
        // visualViewport resize event animates the wrap's height over .2s,
        // and since that lags the keyboard's own show/hide animation, host
        // page background flashes through as a white gap for that duration.
        '.iframe-wrap.vv-tracking { transition: none; }',
        // The expand button only applies while the panel is floating (i.e. NOT
        // fullscreen). Gated to the complement of FULLSCREEN_MAX_W so it can
        // never fight the fullscreen rules below.
        '@media (min-width: ' + (FULLSCREEN_MAX_W + 1) + 'px) {',
        '  .iframe-wrap.expanded { width: 500px; height: 85vh; max-height: calc(100vh - 40px); }',
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
        // Fullscreen breakpoint — DERIVED from the panel geometry above
        // (FULLSCREEN_MQ), not a hardcoded device width. Covers both narrow
        // (portrait phone) and short (landscape phone) viewports so the
        // keyboard tracking engages in either orientation.
        // ── Contextual teaser bubble (Phase 1) — hangs off .fab-wrap so it
        // inherits the fullscreen ":host(.chat-open) .fab-wrap{display:none}"
        // rule and can never overlap an open chat. ──
        '.sb-teaser {',
        '  position: absolute; bottom: calc(100% + 12px);',
        '  ' + (isLeft ? 'left: 0;' : 'right: 0;'),
        '  width: 250px; box-sizing: border-box;',
        '  display: flex; align-items: flex-start;',
        '  padding: 12px 14px;',
        '  background: #f9f9f9; color: #0f172a;',
        '  border: 0.5px solid #0f172a29; border-radius: 16px;',
        '  box-shadow: inset -2px -2px 2px #dadada, inset 2px 2px 2px #ffffff;',
        '  cursor: pointer; pointer-events: auto;',
        '  text-align: start;',
        '  opacity: 0; transform: translateY(6px) scale(0.96);',
        '  transition: opacity 0.25s ease, transform 0.25s ease;',
        '}',
        '.sb-teaser.show { opacity: 1; transform: none; }',
        '@media (prefers-reduced-motion: reduce) { .sb-teaser { transition: none; } }',
        '.sb-teaser::after {',
        '  content: ""; position: absolute; top: 100%;',
        '  ' + (isLeft ? 'left: 26px;' : 'right: 22px;'),
        '  border: 7px solid transparent; border-top-color: #dcdcdc;',
        '}',
        '.sb-teaser:focus-visible { outline: 2px solid ' + themeColor + '; outline-offset: 2px; }',
        '.sb-teaser-x {',
        '  position: absolute; top: -10px; ' + (isLeft ? 'left: -10px;' : 'right: -10px;'),
        '  width: 24px; height: 24px; border-radius: 50%;',
        '  display: flex; align-items: center; justify-content: center;',
        '  background: #ffffff; color: #475569;',
        '  border: 0.5px solid rgba(15,23,42,0.16);',
        '  font-size: 11px; line-height: 1; cursor: pointer; padding: 0;',
        '}',
        '.sb-teaser-x:hover { color: #0f172a; }',
        '.sb-teaser-x:focus-visible { outline: 2px solid ' + themeColor + '; outline-offset: 2px; }',
        '.sb-teaser-body { min-width: 0; flex: 1 1 auto; }',
        '.sb-teaser-line { overflow: hidden; }',
        '.sb-teaser-line-inner { display: inline-block; white-space: inherit; will-change: transform; }',
        '.sb-teaser-title { font-size: 13px; font-weight: 500; line-height: 1.35; color: #020617; }',
        '.sb-teaser-sub { font-size: 12px; line-height: 1.4; color: #64748b; margin-top: 2px; }',
        '.sb-teaser-clip { white-space: nowrap; text-overflow: ellipsis; }',
        '.sb-teaser-fade {',
        '  -webkit-mask-image: linear-gradient(to right, #000 0%, #000 82%, transparent 100%);',
        '  mask-image: linear-gradient(to right, #000 0%, #000 82%, transparent 100%);',
        '}',
        '@media (prefers-color-scheme: dark) {',
        '  .sb-teaser { background: #1e293b; color: #f1f5f9; border-color: rgb(30 41 60); box-shadow: inset -2px -2px 2px #141b28, inset 2px 2px 2px #293954; }',
        '  .sb-teaser::after { border-top-color: #131a28; }',
        '  .sb-teaser-title { color: #f1f5f9; }',
        '  .sb-teaser-sub { color: #94a3b8; }',
        '  .sb-teaser-x { background: #1e293b; color: #cbd5e1; border-color: rgba(255,255,255,0.14); }',
        '}',
        '@media ' + FULLSCREEN_MQ + ' {',
        '  :host {',
        '    ' + (isLeft ? 'left: 12px !important;' : 'right: 12px !important;'),
        '    bottom: 12px !important;',
        '  }',
        '  .iframe-wrap {',
        '    width: 100vw; height: 100dvh; max-height: 100dvh; max-width: 100vw;',
        '    bottom: 0; right: 0; left: 0; top: 0; border-radius: 0;',
        '  }',
        '  .iframe-wrap iframe { border-radius: 0; }',
        '  .fab-wrap { width: 48px; height: 48px; }',
        '  .fab { width: 48px; height: 48px; }',
        '  :host(.chat-open) .fab-wrap { display: none; }',
        // Mobile / fullscreen breakpoints: collapse the card to a slim
        // one-line pill (title only), capped so it never runs past the
        // viewport edge; iOS safe-area keeps it clear of the home indicator.
        '  .sb-teaser {',
        '    width: max-content; max-width: calc(100vw - 32px);',
        '    align-items: center; padding: 8px 14px; border-radius: 999px;',
        '    margin-bottom: env(safe-area-inset-bottom, 0px);',
        '  }',
        '  .sb-teaser::after { display: none; }',
        '  .sb-teaser-sub { display: none; }',
        '  .sb-teaser-title { white-space: nowrap; }',
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
        // Opening the chat cancels any pending teaser and suppresses it for
        // the rest of this session — an engaged visitor is never nagged again.
        this._engageTeaser();
        if (!this._iframeLoaded) this._loadIframe();
        this._wrap.classList.add('open');
        this.classList.add('chat-open');
        if (this._fabWrap) this._fabWrap.classList.add('open');
        this._attachViewportTracking();
        this._postToIframe({ type: 'Sapybase:visibility', open: true });
      } else {
        this._wrap.classList.remove('open');
        this.classList.remove('chat-open');
        if (this._fabWrap) this._fabWrap.classList.remove('open');
        this._detachViewportTracking();
        this._postToIframe({ type: 'Sapybase:visibility', open: false });
      }
    }

    // Mobile keyboard fix for the iframe-wrap: when the on-screen keyboard
    // opens inside the iframe, iOS Safari shrinks visualViewport but leaves
    // the layout viewport unchanged — so a 100dvh wrap shows the host page
    // between the chat input and the keyboard. Track visualViewport.height +
    // offsetTop while open and pin the wrap to the visible region.
    //
    // The wrap is pinned to the live visual viewport (see _attachViewport
    // tracking), which is what actually closes the gap. We additionally lock
    // the host page with overflow:hidden so it can't scroll behind the fixed
    // overlay. We deliberately do NOT reposition <body> with position:fixed —
    // that shifts the host's own content by the scroll offset, which on iOS
    // reads as the whole overlay "wiggling" as the keyboard animates. overflow
    // lock is enough here because the overlay is a separate fixed layer.
    _lockScroll() {
      // Idempotent: sync() may call this on every viewport event while
      // fullscreen. Bail if already locked so we never save the locked
      // (overflow:hidden) values as the "original" ones to restore.
      if (this._savedScrollStyles) return;
      var de = document.documentElement;
      var body = document.body;
      this._savedScrollStyles = {
        deOverflow: de.style.overflow,
        deOverscroll: de.style.overscrollBehavior,
        bodyOverflow: body.style.overflow,
        bodyOverscroll: body.style.overscrollBehavior,
      };
      de.style.overflow = 'hidden';
      de.style.overscrollBehavior = 'none';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
    }

    _unlockScroll() {
      if (!this._savedScrollStyles) return;
      var s = this._savedScrollStyles;
      var de = document.documentElement;
      var body = document.body;
      de.style.overflow = s.deOverflow;
      de.style.overscrollBehavior = s.deOverscroll;
      body.style.overflow = s.bodyOverflow;
      body.style.overscrollBehavior = s.bodyOverscroll;
      this._savedScrollStyles = null;
    }

    _attachViewportTracking() {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      var vv = window.visualViewport;
      var wrap = this._wrap;
      if (!wrap) return;
      var self = this;
      // Same DERIVED breakpoint the fullscreen CSS uses — one source of truth,
      // so JS pinning and CSS layout can never disagree about "is fullscreen".
      var mq = window.matchMedia && window.matchMedia(FULLSCREEN_MQ);
      var sync = function () {
        var fullscreen = !!(mq && mq.matches);
        if (!fullscreen) {
          // Floating panel — hand sizing back to CSS and release any lock
          // (e.g. after a rotate from portrait phone to a wide layout).
          wrap.classList.remove('vv-tracking');
          wrap.style.height = '';
          wrap.style.top = '';
          wrap.style.left = '';
          wrap.style.width = '';
          wrap.style.right = '';
          wrap.style.bottom = '';
          self._unlockScroll();
          return;
        }
        self._lockScroll();
        // Suppress the CSS width/height transition while pinning to the
        // live visual viewport — see the .vv-tracking rule above.
        wrap.classList.add('vv-tracking');
        wrap.style.height = vv.height + 'px';
        wrap.style.top = vv.offsetTop + 'px';
        wrap.style.left = vv.offsetLeft + 'px';
        wrap.style.width = vv.width + 'px';
        // Explicitly clear right/bottom (set by the mobile media query) so
        // top/left/width/height are never fighting an over-constrained box
        // in engines that don't resolve that per spec.
        wrap.style.right = 'auto';
        wrap.style.bottom = 'auto';
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
      this._unlockScroll();
      if (this._wrap) {
        this._wrap.classList.remove('vv-tracking');
        this._wrap.style.height = '';
        this._wrap.style.top = '';
        this._wrap.style.left = '';
        this._wrap.style.width = '';
        this._wrap.style.right = '';
        this._wrap.style.bottom = '';
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
          this._wrap.classList.remove('open');
          this.classList.remove('chat-open');
          if (this._fabWrap) this._fabWrap.classList.remove('open');
          this._detachViewportTracking();
        } else if (data.type === 'Sapybase:ready') {
          if (this._iframeLoader) this._iframeLoader.classList.add('hide');
        } else if (data.type === 'Sapybase:expand') {
          if (data.expanded) {
            this._wrap.classList.add('expanded');
          } else {
            this._wrap.classList.remove('expanded');
          }
        }
      });
    }
  }

  try {
    customElements.define('sapybase-widget', SapybaseWidget);
  } catch {
    // Already defined by another script copy — abort.
    return;
  }

  // Auto-mount from <script data-bot-id="..."> tag.
  // document.currentScript is null when the script is injected dynamically
  // (e.g. Next.js <Script strategy="lazyOnload">), so fall back to a query.
  function autoMount() {
    var currentScript =
      document.currentScript ||
      document.querySelector('script[data-bot-id][src*="sapybase-loader@1.js"]');
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
    } catch {
      // SPA frameworks may replace body during hydration; retry once.
      setTimeout(function () {
        try { document.body.appendChild(el); } catch { /* ignore */ }
      }, 500);
      return;
    }

    // WP cookie banners / sticky CTAs often share max z-index 2147483647;
    // when z-index ties, last-in-DOM wins. Re-append after load so we sit
    // on top of late-injected overlays.
    var reseat = function () {
      try {
        if (el.parentNode === document.body) document.body.appendChild(el);
      } catch { /* ignore */ }
    };
    if (document.readyState === 'complete') setTimeout(reseat, 1500);
    else window.addEventListener('load', function () { setTimeout(reseat, 1500); });
  }

  autoMount();
})();
