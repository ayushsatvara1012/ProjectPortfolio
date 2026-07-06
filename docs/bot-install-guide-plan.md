# Bot Install Guide — stack-aware embed snippet plan

## Problem

After a user creates a bot, the "Live credentials" screen
([CreateBotFlow.tsx:222-305](../src/components/features/CreateBotFlow.tsx)) shows a
generic one-line embed and a static `BotIntegrationDocs` block. Clients run many
different stacks (plain HTML, React/Vue/Angular SPAs, Next.js, WordPress/Shopify/
Webflow) and don't know *where* or *how* to paste the snippet for their setup.

**Goal:** on that same credentials screen, let the user pick their project type
and show **only** the full snippet tailored to that stack, with a short inline
step-by-step explanation directly beneath it.

## Decisions (locked)

- **Persistence:** client-side picker only — pure UI state, nothing saved to the
  bot record. No backend change, no migration. Same component can later be reused
  on a per-bot "Install" screen.
- **Docs depth:** inline explanation under the snippet (self-contained; no
  navigation away). Keep the existing `Full guide →` link to `/docs` as a footer.
- **Stacks (v1):** HTML/CSS · SPA (React/Vue/Angular) · Next.js ·
  WordPress/Shopify/Webflow.

## Current-state notes

- Loader is framework-agnostic already: `public/sapybase-loader.js` mounts a
  `<sapybase-widget>` custom element + Shadow DOM + iframe to `/embed/{botId}`.
  It accepts `data-bot-id` (canonical), `bot-id`, and `data-api-key` (legacy),
  and handles `document.currentScript === null` (defer / dynamic inject) via a
  `querySelector` fallback — so Next.js `lazyOnload` and SPA injection both work
  with no loader changes.
- **Snippet inconsistency to fix:** the "Quick embed" card uses
  `${origin}/widget.js` + `data-api-key`; `BotIntegrationDocs` uses a hardcoded
  `https://www.sapybase.com/sapybase-loader@1.js` + `data-bot-id`. Unify on
  `${origin}/sapybase-loader.js` + `data-bot-id`, origin derived from
  `window.location.origin` so localhost/preview domains work.

## Design

New component: `src/components/features/BotInstallGuide.tsx` (`'use client'`),
replacing the current "Quick embed" card **and** the `BotIntegrationDocs` card in
`CreateBotFlow`'s success view. `BotIntegrationDocs.tsx` is superseded — delete it
after migrating callers (grep first; it's referenced in `CreateBotFlow`).

Data-driven, no per-stack branching in JSX:

```ts
type Stack = {
  id: 'html' | 'spa' | 'nextjs' | 'nocode';
  label: string;
  icon: string;              // Material Symbol
  language: string;          // for the code header chip
  snippet: (origin: string, key: string) => string;
  steps: string[];           // inline "How to install" list
};
```

- A segmented tab row (reuse dashboard `ui` primitives) selects the active stack;
  default = `html`.
- Below it: one code block (dark, copy button, existing terminal-dot chrome from
  `BotIntegrationDocs`) rendering `stack.snippet(origin, apiKey)`.
- Below that: a compact numbered "How to install" list from `stack.steps`.
- Footer keeps `Need help? Full guide →` linking to `/docs`.

### Snippets

**HTML/CSS** — paste before `</body>`:
```html
<script src="{origin}/sapybase-loader.js" data-bot-id="{key}" defer></script>
```

**SPA (React shown; Vue/Angular in steps)**:
```jsx
import { useEffect } from 'react';
export default function ChatWidget() {
  useEffect(() => {
    const s = document.createElement('script');
    s.src = '{origin}/sapybase-loader.js';
    s.async = true;
    s.dataset.botId = '{key}';
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return null;
}
```
Steps note Vue (`onMounted`) and Angular (`ngOnInit`) equivalents.

**Next.js** (App Router):
```jsx
// app/layout.tsx
import Script from 'next/script';
export default function RootLayout({ children }) {
  return (<html><body>{children}
    <Script src="{origin}/sapybase-loader.js" data-bot-id="{key}" strategy="lazyOnload" />
  </body></html>);
}
```

**WordPress / Shopify / Webflow** — same tag, different paste location per steps:
```html
<script src="{origin}/sapybase-loader.js" data-bot-id="{key}" defer></script>
```
Steps: WordPress → *Insert Headers and Footers* plugin (or `footer.php` before
`</body>`); Shopify → `theme.liquid` before `</body>`; Webflow → Project Settings
→ Custom Code → Footer.

## Files touched

- **New:** `src/components/features/BotInstallGuide.tsx`
- **Edit:** `src/components/features/CreateBotFlow.tsx` — replace the Quick-embed
  card + `BotIntegrationDocs` usage (lines ~281-303) with `<BotInstallGuide
  apiKey={registrationData.apiKey} />`; drop the now-unused `handleCopy` snippet
  branch if fully subsumed.
- **Delete:** `src/components/features/BotIntegrationDocs.tsx` (after confirming
  no other importers).
- **Tests:** `src/__tests__/bot-install-guide.test.tsx` — renders, tab switch
  changes snippet text, copy writes the tailored snippet, key/origin interpolated.

## Out of scope (backlog)

- Persisting stack choice to the bot record.
- Reusing the component on a per-bot Install screen in My Bots.
- Adding per-stack anchored sections to `VaayuDocs` (`/docs`).

## Test / ship

- `npm run test` (Vitest) green, `npx tsc --noEmit` clean, `npm run lint` clean.
- Verify in preview: create-bot success screen, switch each tab, copy each
  snippet, confirm `data-bot-id` + origin are correct.
- Commit only on the user's say-so.
