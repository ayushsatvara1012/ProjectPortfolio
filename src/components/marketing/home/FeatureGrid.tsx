import React from 'react';

/* Feature grid — Chatbase-style product-moment cards: 2 big + 3 small.
   Each card pairs a small "product moment" illustration (chat bubbles, a scored
   lead, an ROI readout, handoff notifications) with a short heading + one line.
   Server Component: pure presentational, no interactivity. */

function Moment({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[232px] items-center justify-center overflow-hidden rounded-2xl bg-[#F1F5F9] dark:bg-[#0F172A] px-6 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] dark:bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="relative w-full max-w-[330px]">{children}</div>
    </div>
  );
}

function BotDot() {
  return (
    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#0F172A] dark:bg-[#F8FAFC]">
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-[#FAFAFC] dark:text-[#0B0F19]" aria-hidden="true">
        <path d="M12 3l2 5 5 1-3.5 3.5L17 18l-5-2.5L7 18l.5-5.5L4 9l5-1z" fill="currentColor" />
      </svg>
    </span>
  );
}

const cardShell =
  'flex flex-col overflow-hidden rounded-[22px] border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] p-3 shadow-[0_1px_1px_rgba(26,25,20,0.04),0_6px_16px_-10px_rgba(26,25,20,0.14)] dark:shadow-[0_1px_1px_rgba(0,0,0,0.5),0_8px_20px_-12px_rgba(0,0,0,0.6)]';
const cardTitle = 'font-google text-xl font-bold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]';
const cardBody = 'mt-2.5 font-google text-[15px] leading-[1.55] text-[#475569] dark:text-[#94A3B8]';
const qBubble =
  'inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] px-3 py-2 text-[13px] text-[#0F172A] dark:text-[#F8FAFC] shadow-[0_6px_16px_-10px_rgba(26,25,20,0.14)]';
const aBubble = 'inline-flex items-center gap-2 rounded-xl bg-[#0F172A] dark:bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#FAFAFC] dark:text-[#0B0F19]';
const avatarSm = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAF0FE] dark:bg-[#17203A] text-[11px] font-bold text-[#004DE8] dark:text-[#6E97FF]';
const notif =
  'flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] px-3 py-2.5 text-[12.5px] text-[#0F172A] dark:text-[#F8FAFC] shadow-[0_6px_16px_-10px_rgba(26,25,20,0.14)]';

export default function FeatureGrid() {
  return (
    <section id="features" className="py-28 lg:py-32 transition-colors duration-500">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="mt-4 font-newsreader font-light leading-[1.05] tracking-tight text-4xl text-[#0F172A] dark:text-[#F8FAFC] sm:text-5xl lg:text-6xl">
            Everything your website needs to answer, capture, and convert
          </h2>
          <p className="mt-4 font-google text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8]">
            One agent trained on your content — doing the work of a support rep and a sales rep at once.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pillar 1 — grounded answers */}
          <div className={cardShell}>
            <div className="overflow-hidden rounded-2xl">
              <img
                src="/specs_dig_1.svg"
                alt="Document Answers Illustration"
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="px-4 pb-6 pt-6">
              <h3 className={cardTitle}>It only answers from your documents</h3>
              <p className={cardBody}>
                Vaayu retrieves from your own content and cites the source. If the answer isn&apos;t there, it says so — no invented prices, no made-up policies.
              </p>
            </div>
          </div>

          {/* Pillar 2 — lead capture */}
          <div className={cardShell}>
            <Moment>
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-2 self-end">
                  <span className={qBubble}>I need 200 L in bulk — can you quote?</span>
                  <span className={avatarSm}>R</span>
                </div>
                <div className="flex items-start gap-2">
                  <BotDot />
                  <span className={aBubble}>Sure — let me grab a couple of details.</span>
                </div>
                <svg viewBox="0 0 120 22" className="mx-auto h-[22px] w-[120px]" aria-hidden="true">
                  <path d="M60 0 V18" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 4" className="dark:[stroke:#1E293B]" />
                </svg>
                <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] px-3.5 py-3 shadow-[0_6px_16px_-10px_rgba(26,25,20,0.14)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7E9DC] dark:bg-[#2a1c11] text-[14px] font-bold text-[#C25A1B] dark:text-[#E9945B]">R</span>
                  <div>
                    <div className="text-[13px] font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Rajesh — bulk 200 L order</div>
                    <div className="text-[11.5px] text-[#64748B] dark:text-[#64748B]">quote + delivery to Surat</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[10px] font-bold tracking-[0.08em] text-[#C25A1B] dark:text-[#E9945B]">HOT</div>
                    <div className="text-[19px] font-bold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">92</div>
                  </div>
                </div>
              </div>
            </Moment>
            <div className="px-4 pb-6 pt-6">
              <h3 className={cardTitle}>It captures and scores every lead</h3>
              <p className={cardBody}>
                Vaayu spots buying intent mid-chat, collects what matters, and scores each lead hot to cold — so nothing slips through while you sleep.
              </p>
            </div>
          </div>

          {/* Row of 3 */}
          <div className="lg:col-span-2 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ROI */}
            <div className={cardShell}>
              <Moment>
                <div className="w-full max-w-[300px] rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] p-[18px] shadow-[0_6px_16px_-10px_rgba(26,25,20,0.14)]">
                  <div className="text-[11.5px] font-semibold text-[#64748B] dark:text-[#64748B]">Attributed revenue · 30d</div>
                  <div className="mt-0.5 text-[28px] font-bold tracking-[-0.03em] text-[#0F172A] dark:text-[#F8FAFC]">
                    $18,940 <span className="text-[12px] font-semibold text-[#157A52] dark:text-[#45C089]">▲34%</span>
                  </div>
                  <svg viewBox="0 0 260 64" preserveAspectRatio="none" className="mt-3 h-14 w-full" aria-hidden="true">
                    <path d="M0 52 C40 48 60 30 92 30 130 30 150 42 182 24 214 8 236 12 260 5 L260 64 L0 64Z" fill="#004DE8" fillOpacity="0.08" />
                    <path d="M0 52 C40 48 60 30 92 30 130 30 150 42 182 24 214 8 236 12 260 5" fill="none" stroke="#004DE8" strokeWidth="2.4" strokeLinecap="round" className="dark:[stroke:#6E97FF]" />
                    <circle cx="260" cy="5" r="3.6" fill="#004DE8" className="dark:[fill:#6E97FF]" />
                  </svg>
                </div>
              </Moment>
              <div className="px-4 pb-6 pt-6">
                <h3 className={cardTitle}>It proves the ROI</h3>
                <p className={cardBody}>Every chat ties to a funnel and attributes the revenue — so you see what it earned, not a black box.</p>
              </div>
            </div>

            {/* Owner handoff */}
            <div className={cardShell}>
              <Moment>
                <div className="flex w-full max-w-[300px] flex-col items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#004DE8] to-[#002B82] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-[0_6px_16px_-10px_rgba(26,25,20,0.4)]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" /></svg>
                    Hot lead — notify owner
                  </span>
                  <svg viewBox="0 0 200 20" className="h-5 w-[180px]" aria-hidden="true">
                    <path d="M40 2 V10 H160 M100 2 V10" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 4" className="dark:[stroke:#1E293B]" />
                  </svg>
                  <div className="flex w-full flex-col gap-2.5">
                    <div className={notif}>
                      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-[#EFE9FC] text-[#7C4DE0] dark:bg-[#201938] dark:text-[#A78BFF]">
                        <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden="true"><path d="M6 9a2 2 0 1 1 2-2v2H6zm0 1h2v2a2 2 0 1 1-2-2zm9-4a2 2 0 1 1 2 2h-2V6zm-1 0v2h-2a2 2 0 1 1 2-2z" fill="currentColor" /></svg>
                      </span>
                      <div><b className="font-semibold">Slack</b> · #leads — Rajesh, HOT 92</div>
                    </div>
                    <div className={notif}>
                      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-[#EAF0FE] text-[#004DE8] dark:bg-[#17203A] dark:text-[#6E97FF]">
                        <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                      </span>
                      <div><b className="font-semibold">Email</b> · New hot lead + transcript</div>
                    </div>
                  </div>
                </div>
              </Moment>
              <div className="px-4 pb-6 pt-6">
                <h3 className={cardTitle}>It hands off to you instantly</h3>
                <p className={cardBody}>The moment a hot lead lands, Vaayu pings you on Slack and email with the full context — reply while they&apos;re still warm.</p>
              </div>
            </div>

            {/* Advanced */}
            <div className={cardShell}>
              <Moment>
                <div className="flex w-full max-w-[300px] flex-col items-center gap-3">
                  <div className={`${notif} w-full`}>
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-[#F7E9DC] text-[#C25A1B] dark:bg-[#2a1c11] dark:text-[#E9945B]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden="true"><path d="M9 3h6v5l4 9a2 2 0 0 1-1.8 2.9H6.8A2 2 0 0 1 5 17l4-9V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                    </span>
                    <div><b className="font-semibold">Chemical pack</b> · SDS, quotes, samples</div>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F5F9] dark:bg-[#0F172A] px-3.5 py-1.5 text-[12px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">config, not code</span>
                  <div className={`${notif} w-full`}>
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-[#EAF0FE] text-[#004DE8] dark:bg-[#17203A] dark:text-[#6E97FF]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" stroke="currentColor" strokeWidth="1.7" /></svg>
                    </span>
                    <div><b className="font-semibold">Your own Postgres</b> · bring your database</div>
                  </div>
                </div>
              </Moment>
              <div className="px-4 pb-6 pt-6">
                <h3 className={cardTitle}>It&apos;s built for your industry</h3>
                <p className={cardBody}>Turn on a vertical pack (like the chemical agent, with quotes and samples) and bring your own database — all config, no forking.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
