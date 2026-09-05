import React from 'react';

/* The Insights Dashboard, rebuilt as markup instead of the screenshot it was
   traced from. Reasons it is not a PNG: it stays crisp at every DPI, it follows
   the theme, and it carries no customer names or avatars.

   It is laid out at one fixed width and scaled as a whole by its parent, so a
   phone shows the same composition a laptop does, only smaller. Nothing here
   may carry a responsive variant - a `sm:` class would key off the viewport
   rather than the scaled box and break that equivalence.

   The height is deliberately not pinned. Content sets it, so a longer gap list
   can never be clipped the way a fixed height clipped it before.

   Content is representative of a real workspace, not a specific one. */

export const MOCK_WIDTH = 1152;

type Conversation = {
  title: string;
  meta: string;
  gaps?: boolean;
};

const CONVERSATIONS: Conversation[] = [
  { title: 'Do you ship to Gujarat?', meta: 'Sep 5 · 10:24 AM   ·   9 msgs', gaps: true },
  { title: 'Need the SDS for Toluene', meta: 'Sep 2 · 02:01 PM   ·   3 msgs' },
];

const GAPS = [
  { q: 'What is the lead time on 200L drums?', asked: '4×', when: 'Sep 5' },
  { q: 'Can I connect an external database as a source?', asked: '3×', when: 'Sep 5' },
  { q: 'Do you provide a COA with every batch?', asked: '2×', when: 'Aug 29' },
  { q: 'Is there a bulk discount above 500 kg?', asked: '2×', when: 'Aug 29' },
  { q: 'Which couriers do you use for hazmat freight?', asked: '1×', when: 'Aug 29' },
];

const RAIL_ICONS = ['smart_toy', 'psychology', 'monitoring', 'payments', 'database', 'settings'];

const TABS = [
  { icon: 'sell', label: 'Sales & Leads' },
  { icon: 'forum', label: 'Conversations' },
  { icon: 'trending_up', label: 'Funnel & Insights' },
];

export default function DashboardMock() {
  return (
    <div
      style={{ width: MOCK_WIDTH }}
      className="flex shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-900/10 bg-white dark:border-white/10 dark:bg-slate-950"
    >
      <BrowserBar />

      <div className="flex">
        <IconRail />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />

          <div className="flex items-stretch gap-4 bg-slate-50/60 p-4 dark:bg-slate-900/40">
            <ConversationsPanel />
            <GapsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function BrowserBar() {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-slate-900/10 bg-slate-100/80 px-4 py-2.5 dark:border-white/10 dark:bg-slate-900">
      <span className="flex gap-1.5">
        <i className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        <i className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        <i className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />
      </span>
      <span className="mx-auto rounded-md bg-white px-3 py-1 font-google text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        app.sapybase.com/dashboard
      </span>
    </div>
  );
}

function IconRail() {
  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-slate-900/[0.07] bg-white py-3 dark:border-white/10 dark:bg-slate-950">
      {RAIL_ICONS.map((icon, i) => (
        <span
          key={icon}
          className={`material-symbols-outlined flex size-7 items-center justify-center rounded-lg text-[15px] ${
            i === 2
              ? 'bg-slate-900/[0.06] text-slate-900 dark:bg-white/10 dark:text-white'
              : 'text-slate-400 dark:text-slate-600'
          }`}
        >
          {icon}
        </span>
      ))}
    </div>
  );
}

function AppHeader() {
  return (
    <div className="shrink-0 border-b border-slate-900/[0.07] bg-white px-5 dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-center gap-2 py-2.5 font-google text-[11px] text-slate-400 dark:text-slate-500">
        <span className="text-slate-500 dark:text-slate-400">Workspace</span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Growth
        </span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">Insights Dashboard</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-900/10 px-2 py-1 text-[10px] font-medium text-slate-700 dark:border-white/10 dark:text-slate-200">
          <span className="material-symbols-outlined text-[13px]">smart_toy</span>
          Vaayu
        </span>
      </div>

      <div className="flex gap-6">
        {TABS.map((tab, i) => (
          <span
            key={tab.label}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2 font-google text-xs ${
              i === 1
                ? 'border-[#004DE8] font-medium text-[#004DE8] dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
            {tab.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConversationsPanel() {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-900/[0.07] bg-white dark:border-white/10 dark:bg-slate-950">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-900/[0.07] px-4 py-2.5 dark:border-white/10">
        <span className="material-symbols-outlined text-[15px] text-slate-400">forum</span>
        <span className="font-google text-sm font-semibold text-slate-900 dark:text-slate-100">
          257 conversations
        </span>
        <span className="ml-auto flex gap-1.5">
          <span className="rounded-full bg-slate-900 px-2.5 py-1 font-google text-[10px] font-medium text-white dark:bg-white dark:text-slate-900">
            All
          </span>
          <span className="flex items-center gap-1 rounded-full border border-slate-900/10 px-2.5 py-1 font-google text-[10px] text-slate-600 dark:border-white/10 dark:text-slate-300">
            <i className="size-1.5 rounded-full bg-amber-500" />
            Has gaps
          </span>
        </span>
      </div>

      {CONVERSATIONS.map((c) => (
        <ConversationRow key={c.title} {...c} />
      ))}

      <ExpandedThread />
    </div>
  );
}

function ConversationRow({ title, meta, gaps }: Conversation) {
  return (
    <div
      className={`shrink-0 border-b border-slate-900/[0.06] px-4 py-2.5 dark:border-white/[0.07] ${
        gaps ? 'border-l-2 border-l-amber-400' : 'border-l-2 border-l-transparent'
      }`}
    >
      <p className="truncate font-google text-[13px] text-slate-800 dark:text-slate-200">{title}</p>
      <p className="mt-1 flex items-center gap-2 font-google text-[10px] text-slate-400 dark:text-slate-500">
        <span className="truncate">{meta}</span>
        {gaps && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <i className="size-1 rounded-full bg-amber-500" />
            Has gaps
          </span>
        )}
      </p>
    </div>
  );
}

/* The point of the whole hero: an unanswered question, caught and offered back
   to the owner to teach. Kept expanded so it reads without interaction. */
function ExpandedThread() {
  return (
    <div className="min-h-0 border-l-2 border-l-amber-400 px-4 py-3">
      <p className="font-google text-[13px] text-slate-800 dark:text-slate-200">
        Pricing for a bulk order
      </p>
      <p className="mt-1 font-google text-[10px] text-slate-400 dark:text-slate-500">
        Aug 29 · 12:16 PM   ·   17 msgs
      </p>

      <div className="mt-3 space-y-3">
        <Turn role="USER" time="12:08 PM" text="What's your lead time on 200L drums?" />
        <Answer
          text="I don't have that on file. Let me get someone from the team to pick this up with you."
          unanswered
        />
        <span className="flex items-center gap-1.5 font-google text-[11px] font-medium text-[#004DE8] dark:text-blue-400">
          <span className="material-symbols-outlined text-[14px]">school</span>
          Teach the assistant
        </span>
      </div>
    </div>
  );
}

function Turn({ role, time, text }: { role: string; time: string; text: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 font-google text-[9px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
        <span className="material-symbols-outlined text-[12px]">person</span>
        {role}
        <span className="ml-auto font-normal tracking-normal">{time}</span>
      </p>
      <p className="mt-1 font-google text-[12px] text-slate-800 dark:text-slate-200">{text}</p>
    </div>
  );
}

function Answer({ text, unanswered }: { text: string; unanswered?: boolean }) {
  return (
    <div className="border-l-2 border-amber-400 pl-2.5">
      <p className="flex items-center gap-1.5 font-google text-[9px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
        ASSISTANT
        {unanswered && (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] tracking-normal text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            Unanswered
          </span>
        )}
      </p>
      <p className="mt-1 font-google text-[12px] text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
}

function GapsPanel() {
  return (
    <div className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-900/[0.07] bg-white dark:border-white/10 dark:bg-slate-950">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-900/[0.07] px-4 py-2.5 dark:border-white/10">
        <span className="material-symbols-outlined text-[15px] text-amber-500">build</span>
        <span className="font-google text-sm font-semibold text-slate-900 dark:text-slate-100">
          Gaps to teach
        </span>
        <span className="ml-auto flex gap-1.5">
          {['10', '14'].map((n) => (
            <span
              key={n}
              className="flex items-center gap-1 rounded-full border border-amber-300/60 px-2 py-0.5 font-google text-[10px] text-amber-700 dark:border-amber-500/30 dark:text-amber-400"
            >
              <i className="size-1 rounded-full bg-amber-500" />
              {n}
            </span>
          ))}
        </span>
      </div>

      {GAPS.map((g) => (
        <div
          key={g.q}
          className="shrink-0 border-b border-slate-900/[0.06] px-4 py-2.5 dark:border-white/[0.07]"
        >
          <p className="flex gap-2 font-google text-[12px] leading-snug text-slate-800 dark:text-slate-200">
            <i className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
            {g.q}
          </p>
          <p className="mt-1 pl-3 font-google text-[10px] text-slate-400 dark:text-slate-500">
            <span className="text-amber-600 dark:text-amber-500">Unanswered</span>
            {'   '}Asked {g.asked}
            {'   '}
            {g.when}
          </p>
        </div>
      ))}
    </div>
  );
}
