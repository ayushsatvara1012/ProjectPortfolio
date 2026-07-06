'use client';

// ─────────────────────────────────────────────────────────────────────────────
// BotInstallGuide — stack-aware embed instructions shown on the create-bot
// success screen. The loader (public/sapybase-loader.js) is fully
// framework-agnostic; this component only tailors the *snippet shape* and the
// *where-to-paste* explanation to the client's project type. No backend state —
// the picker is pure UI. Supersedes the old BotIntegrationDocs.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cx } from '@/src/components/dashboard/insights/ui';

type StackId =
  | 'html' | 'react' | 'vue' | 'angular' | 'svelte'
  | 'nextjs' | 'nuxt' | 'astro' | 'gatsby'
  | 'wordpress' | 'shopify' | 'webflow' | 'squarespace' | 'wix' | 'gtm';

type Stack = {
  id: StackId;
  label: string;
  group: 'Plain' | 'JS frameworks' | 'Meta-frameworks' | 'No-code & CMS';
  language: string; // header chip + affects loose highlighting
  snippet: (origin: string, key: string) => string;
  steps: string[];
};

// Canonical loader tag. The loader accepts data-bot-id (current), bot-id, and
// data-api-key (legacy); we standardise on data-bot-id + sapybase-loader.js and
// derive the origin at runtime so localhost / preview domains work too.
const tag = (origin: string, key: string, indent = '') =>
  `${indent}<script src="${origin}/sapybase-loader.js"\n${indent}        data-bot-id="${key}"\n${indent}        defer></script>`;

const STACKS: Stack[] = [
  {
    id: 'html',
    label: 'HTML / CSS',
    group: 'Plain',
    language: 'html',
    snippet: (o, k) => `<!-- Paste once, just before </body> on every page -->\n${tag(o, k)}`,
    steps: [
      'Open the HTML file (or shared template/footer) for your site.',
      'Paste the snippet immediately before the closing </body> tag.',
      'Re-upload / redeploy. The chat bubble appears bottom-right on load.',
    ],
  },
  {
    id: 'react',
    label: 'React',
    group: 'JS frameworks',
    language: 'jsx',
    snippet: (o, k) =>
      `// components/ChatWidget.jsx — mount once (e.g. in App.jsx)\nimport { useEffect } from 'react';\n\nexport default function ChatWidget() {\n  useEffect(() => {\n    const s = document.createElement('script');\n    s.src = '${o}/sapybase-loader.js';\n    s.async = true;\n    s.dataset.botId = '${k}';\n    document.body.appendChild(s);\n    return () => s.remove();\n  }, []);\n  return null;\n}`,
    steps: [
      'Create the ChatWidget component above.',
      'Render <ChatWidget /> once near the root of your app (App.jsx).',
      'The cleanup return removes the script on unmount — safe for hot reload.',
    ],
  },
  {
    id: 'vue',
    label: 'Vue',
    group: 'JS frameworks',
    language: 'html',
    snippet: (o, k) =>
      `<!-- App.vue -->\n<script setup>\nimport { onMounted } from 'vue';\nonMounted(() => {\n  const s = document.createElement('script');\n  s.src = '${o}/sapybase-loader.js';\n  s.async = true;\n  s.dataset.botId = '${k}';\n  document.body.appendChild(s);\n});\n</script>`,
    steps: [
      'Add the onMounted hook to your root App.vue (or a layout component).',
      'The loader injects itself into <body> after the app mounts.',
      'For the Options API, use the mounted() lifecycle hook instead.',
    ],
  },
  {
    id: 'angular',
    label: 'Angular',
    group: 'JS frameworks',
    language: 'ts',
    snippet: (o, k) =>
      `// app.component.ts\nimport { Component, OnInit } from '@angular/core';\n\n@Component({ selector: 'app-root', template: '<router-outlet></router-outlet>' })\nexport class AppComponent implements OnInit {\n  ngOnInit() {\n    const s = document.createElement('script');\n    s.src = '${o}/sapybase-loader.js';\n    s.async = true;\n    s.dataset.botId = '${k}';\n    document.body.appendChild(s);\n  }\n}`,
    steps: [
      'Add the ngOnInit hook to your root AppComponent.',
      'Alternatively, add the plain <script> tag to src/index.html before </body>.',
      'The loader mounts once — safe across route changes.',
    ],
  },
  {
    id: 'svelte',
    label: 'Svelte',
    group: 'JS frameworks',
    language: 'html',
    snippet: (o, k) =>
      `<!-- App.svelte -->\n<script>\n  import { onMount } from 'svelte';\n  onMount(() => {\n    const s = document.createElement('script');\n    s.src = '${o}/sapybase-loader.js';\n    s.async = true;\n    s.dataset.botId = '${k}';\n    document.body.appendChild(s);\n  });\n</script>`,
    steps: [
      'Add the onMount block to your root App.svelte.',
      'For SvelteKit, put this in src/routes/+layout.svelte instead.',
      'onMount only runs in the browser, so the loader never runs during SSR.',
    ],
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    group: 'Meta-frameworks',
    language: 'jsx',
    snippet: (o, k) =>
      `// app/layout.tsx (App Router)\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <body>\n        {children}\n        <Script\n          src="${o}/sapybase-loader.js"\n          data-bot-id="${k}"\n          strategy="lazyOnload"\n        />\n      </body>\n    </html>\n  );\n}`,
    steps: [
      'Add next/script to your root layout (App Router) or _app.tsx (Pages Router).',
      'strategy="lazyOnload" defers the widget until the page is idle.',
      'The loader handles Next.js dynamic injection automatically — no extra config.',
    ],
  },
  {
    id: 'nuxt',
    label: 'Nuxt',
    group: 'Meta-frameworks',
    language: 'ts',
    snippet: (o, k) =>
      `// nuxt.config.ts\nexport default defineNuxtConfig({\n  app: {\n    head: {\n      script: [\n        { src: '${o}/sapybase-loader.js', 'data-bot-id': '${k}', defer: true },\n      ],\n    },\n  },\n});`,
    steps: [
      'Add the script entry to app.head in nuxt.config.ts.',
      'Nuxt injects it site-wide, on both SSR and client-rendered pages.',
      'No component changes needed — it loads on every route.',
    ],
  },
  {
    id: 'astro',
    label: 'Astro',
    group: 'Meta-frameworks',
    language: 'html',
    snippet: (o, k) => `<!-- src/layouts/Layout.astro — before </body> -->\n${tag(o, k)}`,
    steps: [
      'Open your shared layout (e.g. src/layouts/Layout.astro).',
      'Paste the snippet just before the closing </body> tag.',
      'Every page using that layout gets the widget automatically.',
    ],
  },
  {
    id: 'gatsby',
    label: 'Gatsby',
    group: 'Meta-frameworks',
    language: 'jsx',
    snippet: (o, k) =>
      `// gatsby-ssr.js\nimport React from 'react';\n\nexport const onRenderBody = ({ setPostBodyComponents }) => {\n  setPostBodyComponents([\n    <script\n      key="sapybase"\n      src="${o}/sapybase-loader.js"\n      data-bot-id="${k}"\n      defer\n    />,\n  ]);\n};`,
    steps: [
      'Add the onRenderBody export to gatsby-ssr.js at your project root.',
      'setPostBodyComponents injects the script after <body> content.',
      'Run gatsby build && gatsby serve to verify, then deploy.',
    ],
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    group: 'No-code & CMS',
    language: 'html',
    snippet: (o, k) => tag(o, k),
    steps: [
      'Easiest: install the free "WPCode" or "Insert Headers and Footers" plugin.',
      'Paste the snippet into the Footer / Body section and save.',
      'No plugin? Add it to your theme\'s footer.php before </body> (child theme recommended).',
    ],
  },
  {
    id: 'shopify',
    label: 'Shopify',
    group: 'No-code & CMS',
    language: 'html',
    snippet: (o, k) => tag(o, k),
    steps: [
      'Admin → Online Store → Themes → ⋯ → Edit code.',
      'Open Layout / theme.liquid and paste the snippet just before </body>.',
      'Save. The widget now shows across the whole storefront.',
    ],
  },
  {
    id: 'webflow',
    label: 'Webflow',
    group: 'No-code & CMS',
    language: 'html',
    snippet: (o, k) => tag(o, k),
    steps: [
      'Project Settings → Custom Code → Footer Code.',
      'Paste the snippet and save.',
      'Publish your site for the change to go live.',
    ],
  },
  {
    id: 'squarespace',
    label: 'Squarespace',
    group: 'No-code & CMS',
    language: 'html',
    snippet: (o, k) => tag(o, k),
    steps: [
      'Settings → Advanced → Code Injection.',
      'Paste the snippet into the Footer box and save.',
      'Requires a Business plan or higher for code injection.',
    ],
  },
  {
    id: 'wix',
    label: 'Wix',
    group: 'No-code & CMS',
    language: 'html',
    snippet: (o, k) => tag(o, k),
    steps: [
      'Settings → Custom Code → + Add Custom Code.',
      'Paste the snippet, set it to load on "All pages" and place in "Body - end".',
      'Apply. Requires a connected domain (paid plan).',
    ],
  },
  {
    id: 'gtm',
    label: 'Google Tag Manager',
    group: 'No-code & CMS',
    language: 'html',
    snippet: (o, k) =>
      `<!-- New Tag → Custom HTML -->\n${tag(o, k)}`,
    steps: [
      'In GTM, create a new Tag → Custom HTML and paste the snippet.',
      'Set the trigger to "All Pages", then Save.',
      'Submit & Publish the container to push it live.',
    ],
  },
];

const GROUP_ORDER: Stack['group'][] = ['Plain', 'JS frameworks', 'Meta-frameworks', 'No-code & CMS'];

type Props = { apiKey?: string };

export default function BotInstallGuide({ apiKey = 'YOUR_BOT_ID' }: Props) {
  const [active, setActive] = useState<StackId>('html');
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.sapybase.com';
  const stack = STACKS.find((s) => s.id === active) ?? STACKS[0];
  const code = useMemo(() => stack.snippet(origin, apiKey), [stack, origin, apiKey]);

  const handleCopy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta); return ok;
    };
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(done).catch(() => { if (fallback()) done(); });
      } else if (fallback()) done();
    } catch { if (fallback()) done(); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">rocket_launch</span>
        <h3 className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-slate-100">Install on your site</h3>
      </div>
      <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
        Pick your project type — the snippet and steps update to match. Need more?{' '}
        <Link href="/docs" className="font-semibold text-slate-700 dark:text-slate-300 underline underline-offset-4 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Full guide →</Link>
      </p>

      {/* Stack picker — grouped chips */}
      <div className="flex flex-col gap-2.5 mb-4">
        {GROUP_ORDER.map((group) => (
          <div key={group} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-full sm:w-auto sm:mr-1">{group}</span>
            {STACKS.filter((s) => s.group === group).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                aria-pressed={active === s.id}
                className={cx(
                  'rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors border',
                  active === s.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Snippet */}
      <div className="rounded-2xl overflow-hidden bg-slate-900 dark:bg-slate-950 border border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span className="ml-2 text-[11px] font-mono uppercase tracking-wider text-slate-500">{stack.language}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[13px]">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="p-4 overflow-x-auto custom-scrollbar">
          <pre className="m-0 text-[12px] sm:text-[12.5px] leading-relaxed font-mono text-slate-300 whitespace-pre">{code}</pre>
        </div>
      </div>

      {/* Where to paste — per-stack steps */}
      <div className="mt-4">
        <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 mb-2">How to install ({stack.label})</p>
        <ol className="flex flex-col gap-1.5">
          {stack.steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">{i + 1}</span>
              <span className="flex-1 pt-px">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
