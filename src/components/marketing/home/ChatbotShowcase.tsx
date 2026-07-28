import React from 'react';
import ChatbotShowcaseOrnament from '../ChatbotShowcaseOrnament';

/* Chatbot showcase — two vertical-bot mockups (generic + chemical) over the
   shared page mesh gradient. Server Component (no interactivity). */
export default function ChatbotShowcase() {
  return (
    <section
      id="chatbots"
      className="relative py-16 sm:py-24 overflow-hidden transition-colors duration-500"
    >
      <ChatbotShowcaseOrnament />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <h2 className="mb-4 text-center font-newsreader font-light tracking-tight leading-[1.05] text-4xl sm:text-5xl lg:text-6xl text-slate-900 dark:text-white">
          Our two new chatbots
        </h2>

        <p className="mb-10 text-center text-sm sm:text-base font-google font-medium text-[#002B82]/80 dark:text-[#6E97FF] tracking-wide">
          One assistant, tailored to every business — from service bookings to chemical distribution
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start justify-items-center">
          <GenericChatPanel />
          <ChemicalHubPanel />
        </div>
      </div>
    </section>
  );
}

/* Generic-vertical panel — a live conversation, browser-chrome treatment,
   full uncropped window. */
function GenericChatPanel() {
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-[24px] border border-slate-200/70 bg-white/60 p-5 sm:p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <p className="sr-only">
        Chat conversation: customer asks about a Saturday booking slot and pricing; Vaayu answers with availability and price, citing the services FAQ.
      </p>
      <img
        src="/generic_chat.svg"
        alt="Chat conversation mockup"
        className="block h-auto w-full rounded-[16px]"
        width={300}
        height={400}
      />
    </div>
  );
}

/* Chemical-vertical panel — assistant mockup displaying hub options and chemical query flows. */
function ChemicalHubPanel() {
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-[24px] border border-slate-200/70 bg-white/60 p-5 sm:p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <p className="sr-only">
        Expresolv AI chemical assistant chat conversation mockup.
      </p>
      <img
        src="/chemical_chat.svg"
        alt="Expresolv AI chemical assistant chat mockup"
        className="block h-auto w-full rounded-[16px]"
        width={300}
        height={400}
      />
    </div>
  );
}
