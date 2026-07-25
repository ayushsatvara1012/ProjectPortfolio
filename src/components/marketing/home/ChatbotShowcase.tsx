import React from 'react';
import PreFooterCanvas from '../PreFooterCanvas';

/* Chatbot showcase — two vertical-bot mockups (generic + chemical) over an
   animated 3D dot matrix background. Server Component (no interactivity). */
export default function ChatbotShowcase() {
  return (
    <section
      id="chatbots"
      className="relative bg-[#FAFAFC] dark:bg-[#0B0F19] py-16 sm:py-24 overflow-hidden transition-colors duration-500"
    >
      {/* Animated 3D Dot Matrix Canvas Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <PreFooterCanvas className="relative w-full h-full overflow-hidden select-none" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <p className="mb-10 text-center text-[13px] sm:text-[14px] font-google font-semibold text-[#002B82]/80 dark:text-[#6E97FF] tracking-wide">
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
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[18px]">
      <p className="sr-only">
        Chat conversation: customer asks about a Saturday booking slot and pricing; Vaayu answers with availability and price, citing the services FAQ.
      </p>
      <img
        src="/generic_chat.svg"
        alt="Chat conversation mockup"
        className="block h-auto w-full"
        width={300}
        height={400}
      />
    </div>
  );
}

/* Chemical-vertical panel — assistant mockup displaying hub options and chemical query flows. */
function ChemicalHubPanel() {
  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[18px]">
      <p className="sr-only">
        Expresolv AI chemical assistant chat conversation mockup.
      </p>
      <img
        src="/chemical_chat.svg"
        alt="Expresolv AI chemical assistant chat mockup"
        className="block h-auto w-full"
        width={300}
        height={400}
      />
    </div>
  );
}
