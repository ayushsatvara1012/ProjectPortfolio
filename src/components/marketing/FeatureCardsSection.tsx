'use client';

import React, { useState } from 'react';

// Card 1 SVG: 24/7 Support Chat Mockup
const SupportChatSVG = ({ userMsg, botMsg }: { userMsg: string; botMsg: string }) => (
  <svg viewBox="0 0 320 220" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <foreignObject x="0" y="0" width="320" height="220">
      <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900/60 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-800/40 font-sans select-none">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800/80 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="relative flex items-center">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              VY
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-800" />
          </div>
          <div className="text-left">
            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-none">Vaayu AI</p>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-none mt-0.5">Active now</p>
          </div>
        </div>
        {/* Message Area */}
        <div className="flex-1 p-3 flex flex-col justify-end gap-2.5">
          {/* User Bubble */}
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-blue-600 dark:bg-blue-500 text-white text-[10px] rounded-2xl rounded-tr-none px-3.5 py-2 leading-relaxed shadow-sm text-left">
              {userMsg}
            </div>
          </div>
          {/* Bot Bubble */}
          <div className="flex gap-1.5 items-start">
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px] shrink-0 text-blue-600 dark:text-blue-400">
              ✨
            </div>
            <div className="max-w-[80%] bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 text-[10px] rounded-2xl rounded-tl-none px-3.5 py-2 leading-relaxed shadow-sm text-left">
              {botMsg}
            </div>
          </div>
        </div>
      </div>
    </foreignObject>
  </svg>
);

// Card 2 SVG: Lead Capture & Live Alerts Mockup
const LeadScoreChatSVG = ({
  userMsg,
  botMsg,
  badgeText,
  badgeColor,
  leadDetail,
}: {
  userMsg: string;
  botMsg: string;
  badgeText: string;
  badgeColor: string;
  leadDetail: string;
}) => (
  <svg viewBox="0 0 320 220" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <foreignObject x="0" y="0" width="320" height="220">
      <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900/60 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-800/40 font-sans select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200/30 dark:border-amber-900/40 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]">💬</span>
            <span className="text-[9px] font-medium text-amber-800 dark:text-amber-300">Slack lead-alerts channels</span>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${badgeColor}`}>
            {badgeText}
          </div>
        </div>
        {/* Chat / Capture Form */}
        <div className="flex-1 p-3 flex flex-col justify-end gap-2 text-left">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-amber-600 dark:bg-amber-500 text-white text-[9px] rounded-2xl rounded-tr-none px-3 py-1.5 shadow-sm">
              {userMsg}
            </div>
          </div>
          {/* Bot reply */}
          <div className="flex gap-1.5 items-start">
            <div className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-[9px] shrink-0 text-amber-600 dark:text-amber-400 font-bold">
              VY
            </div>
            <div className="max-w-[80%] bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 text-[9px] rounded-2xl rounded-tl-none px-2.5 py-1.5 shadow-sm">
              {botMsg}
            </div>
          </div>
          {/* Output Card */}
          <div className="mt-1 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-lg p-2 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600 text-[10px] font-bold">
                LD
              </div>
              <div>
                <p className="text-[9px] font-semibold text-slate-800 dark:text-slate-200 leading-none">Lead Captured</p>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5 leading-none truncate max-w-[140px]">{leadDetail}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400 leading-none">Scored: High</p>
              <p className="text-[7px] text-slate-400 dark:text-slate-500 leading-none mt-0.5">Intent: 98%</p>
            </div>
          </div>
        </div>
      </div>
    </foreignObject>
  </svg>
);

// Card 3 SVG: Funnel & ROI Dashboard Mockup
const ROIAnalyticsSVG = ({
  conversionRate,
  countText,
  countVal,
  roiMultiplier,
  revenueAdded,
}: {
  conversionRate: string;
  countText: string;
  countVal: string;
  roiMultiplier: string;
  revenueAdded: string;
}) => (
  <svg viewBox="0 0 320 220" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <foreignObject x="0" y="0" width="320" height="220">
      <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900/60 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-800/40 font-sans p-3 select-none text-left justify-between">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">ROI Insights</span>
          <span className="text-[8px] text-slate-400 dark:text-slate-500">Live conversion funnel</span>
        </div>

        {/* Contents Grid */}
        <div className="grid grid-cols-2 gap-2 mt-1.5 flex-1 items-center">
          {/* Funnel chart */}
          <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/40 p-2 rounded-lg">
            <span className="text-[8px] text-slate-400 dark:text-slate-500">Funnel Conversions</span>
            <div className="space-y-1 mt-1">
              <div className="h-2 rounded bg-emerald-500/10 border border-emerald-500/20 relative flex items-center px-1">
                <div className="h-full bg-emerald-500/20 rounded-l absolute left-0 top-0 w-[95%]" />
                <span className="text-[7px] text-emerald-800 dark:text-emerald-300 font-medium z-10">Chats: 100%</span>
              </div>
              <div className="h-2 rounded bg-emerald-500/10 border border-emerald-500/20 relative flex items-center px-1">
                <div className="h-full bg-emerald-500/20 rounded-l absolute left-0 top-0 w-[60%]" />
                <span className="text-[7px] text-emerald-800 dark:text-emerald-300 font-medium z-10">Leads: {countVal}%</span>
              </div>
              <div className="h-2 rounded bg-emerald-500/10 border border-emerald-500/20 relative flex items-center px-1">
                <div className="h-full bg-emerald-500/20 rounded-l absolute left-0 top-0 w-[30%]" />
                <span className="text-[7px] text-emerald-800 dark:text-emerald-300 font-medium z-10">Sales: {conversionRate}</span>
              </div>
            </div>
          </div>

          {/* Stats Box */}
          <div className="flex flex-col gap-2 h-full justify-center">
            {/* ROI badge */}
            <div className="bg-emerald-600 dark:bg-emerald-500 text-white rounded-lg p-2.5 flex flex-col justify-center items-center shadow-sm">
              <span className="text-[14px] font-bold leading-none">{roiMultiplier}</span>
              <span className="text-[7px] text-emerald-100 font-medium tracking-wider uppercase mt-0.5">ROI earned</span>
            </div>
            {/* Attribution */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-center">
              <span className="text-[7px] text-slate-400 dark:text-slate-500 block leading-none">Attributed Value</span>
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block mt-0.5 leading-none">{revenueAdded}</span>
            </div>
          </div>
        </div>

        {/* Footer info line */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1 flex items-center justify-between">
          <span className="text-[8px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            {countText}
          </span>
          <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">100% Attribution</span>
        </div>
      </div>
    </foreignObject>
  </svg>
);

type VerticalKey = 'homeServices' | 'professionalServices' | 'saasTech';

interface VerticalContent {
  tabLabel: string;
  icon: string;
  headline: string;
  ctaText: string;
  cards: {
    card1: {
      title: string;
      description: string;
      userMsg: string;
      botMsg: string;
    };
    card2: {
      title: string;
      description: string;
      userMsg: string;
      botMsg: string;
      badgeText: string;
      badgeColor: string;
      leadDetail: string;
    };
    card3: {
      title: string;
      description: string;
      conversionRate: string;
      countText: string;
      countVal: string;
      roiMultiplier: string;
      revenueAdded: string;
    };
  };
}

const verticals: Record<VerticalKey, VerticalContent> = {
  homeServices: {
    tabLabel: 'Home Services',
    icon: 'home',
    headline: 'Turn online searches into booked service jobs',
    ctaText: 'Explore contractor features',
    cards: {
      card1: {
        title: 'Answer emergency calls 24/7',
        description: 'Vaayu responds instantly to late-night queries about AC breakdowns, leaking roofs, or emergency plumbing, booking jobs while your competitors sleep.',
        userMsg: 'My basement is flooding. Do you have an emergency plumber available right now?',
        botMsg: 'Yes! We have a plumber on call. What is your address so I can dispatch them immediately?',
      },
      card2: {
        title: 'Capture & score hot leads',
        description: 'Extract customer contact info automatically. Vaayu immediately scores high-intent service requests and alerts your crew via Slack or SMS.',
        userMsg: 'Sure, my number is 555-0199 and email is bob@leakrepair.com. Basement is filling fast.',
        botMsg: 'Got it Bob! I have flagged this as an emergency and sent details to the team. Someone will call you in 2 mins.',
        badgeText: '🔥 HOT LEAD',
        badgeColor: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950/40 border border-red-200/50 dark:border-red-900/50',
        leadDetail: 'Bob - Emergency Flood (555-0199)',
      },
      card3: {
        title: 'Track exact jobs ROI',
        description: 'See which campaigns, pages, or locations convert to actual service calls. Connect chatbot conversations directly to booked jobs and closed revenue.',
        conversionRate: '31.2%',
        countText: '34 Booked Jobs',
        countVal: '65',
        roiMultiplier: '15.4x',
        revenueAdded: '+$18,500',
      },
    },
  },
  professionalServices: {
    tabLabel: 'Professional Services',
    icon: 'business_center',
    headline: 'Qualify prospects and book client consultations 24/7',
    ctaText: 'Explore professional service features',
    cards: {
      card1: {
        title: 'Qualify prospects instantly',
        description: "Answer questions about your firm's case studies, hourly rates, and core expertise, steering qualified prospects to book on your calendar.",
        userMsg: 'Do you have experience in B2B SaaS IP litigation or patents?',
        botMsg: 'Yes, our IP group has secured 14 patent wins for SaaS firms. Would you like to schedule a free 15-min discovery call?',
      },
      card2: {
        title: 'Score high-value client briefs',
        description: 'Automatically gather project budgets, timelines, and legal briefs. Vaayu ranks prospects and drops them straight into your CRM.',
        userMsg: 'Reach me at sarah@growthcorp.com. Budget is $20,000/mo, looking to start next month.',
        botMsg: "Excellent Sarah! I've booked your slot for tomorrow at 10 AM. Our lead partner is reviewing your patent brief now.",
        badgeText: '🔥 HOT LEAD',
        badgeColor: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/40 border border-violet-200/50 dark:border-violet-900/50',
        leadDetail: 'Sarah - GrowthCorp ($20k/mo)',
      },
      card3: {
        title: 'Optimize client pipeline',
        description: 'Measure the exact ROI of your digital spend. Know which ads and pages generate the most lucrative legal retainers and consultations.',
        conversionRate: '22.8%',
        countText: '18 Discovery Bookings',
        countVal: '55',
        roiMultiplier: '9.2x',
        revenueAdded: '+$48,000',
      },
    },
  },
  saasTech: {
    tabLabel: 'SaaS & Tech',
    icon: 'terminal',
    headline: 'Convert traffic into free trials and enterprise leads',
    ctaText: 'Explore SaaS & tech features',
    cards: {
      card1: {
        title: 'Deflect developer tickets',
        description: 'Provide instant access to technical docs, setup commands, and API guides, resolving developer and user queries on the fly without human agents.',
        userMsg: 'How do I sync custom user metadata in the React SDK?',
        botMsg: 'Use the `identifyUser` method inside the `<UserIdentityContext>` provider. Set metadata keys in the config block like this...',
      },
      card2: {
        title: 'Route enterprise deals',
        description: 'Identify corporate emails from Fortune 500 domains in chat. Instantly alert your sales team in Slack to jump in and close the deal.',
        userMsg: "My corporate email is alex@chevron.com. We need to deploy Vaayu across 250 customer reps.",
        botMsg: 'Nice to meet you Alex! I have flagged this for our Enterprise VP. They will email you a custom SLA sheet in 5 minutes.',
        badgeText: '⚡ ENTERPRISE',
        badgeColor: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/50',
        leadDetail: 'Alex - Chevron (250 seats)',
      },
      card3: {
        title: 'Optimize trial conversion',
        description: 'Connect conversations directly to trial signups and upgrades. Trace customer questions to subscription sales and added ARR.',
        conversionRate: '14.5%',
        countText: '86 Trials Activated',
        countVal: '40',
        roiMultiplier: '11.2x',
        revenueAdded: '+$6,200/mo',
      },
    },
  },
};

const FeatureCardsSection = () => {
  const [activeTab, setActiveTab] = useState<VerticalKey>('homeServices');
  const activeContent = verticals[activeTab];

  return (
    <section className="relative w-full bg-[#EDF8FF] dark:bg-[#0A1128] py-20 lg:py-24 transition-colors duration-500 overflow-hidden">
      {/* Immersive background glows */}
      <div className="absolute top-1/4 left-[-10%] w-[450px] h-[450px] bg-blue-400/10 dark:bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-[-10%] w-[450px] h-[450px] bg-indigo-400/15 dark:bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">
        
        {/* Dynamic Nav Switcher */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1.5 bg-blue-200/30 dark:bg-blue-950/30 backdrop-blur-md rounded-full border border-blue-200/40 dark:border-blue-900/30 shadow-inner">
            {(Object.keys(verticals) as VerticalKey[]).map((key) => {
              const item = verticals[key];
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  {item.tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Heading & Dynamic CTA Button */}
        <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
          <h2 className="font-google font-medium text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight leading-tight transition-all duration-300">
            {activeContent.headline}
          </h2>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 font-google font-medium text-sm sm:text-base text-white bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all duration-300 rounded-full px-8 py-3.5 shadow-lg shadow-blue-500/20 cursor-pointer"
            >
              {activeContent.ctaText}
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          
          {/* Card 1: 24/7 AI Support (Text top, SVG bottom) */}
          <div className="relative flex flex-col md:flex-row lg:flex-col rounded-[32px] p-6 sm:p-8 h-auto lg:h-[560px] xl:h-[600px] min-w-[300px] md:min-w-[680px] lg:min-w-0 bg-gradient-to-b from-white/95 to-sky-50/50 dark:from-[#0F1B36] dark:to-[#091022] border border-sky-100 dark:border-sky-950/80 transition-all duration-500 shadow-sm overflow-hidden group gap-6 md:gap-8 lg:gap-0">
            <div className="w-full md:w-[45%] lg:w-full lg:h-[35%] flex flex-col justify-start mb-0 md:mb-0 lg:mb-0">
              <h3 className="font-google font-semibold text-2xl text-slate-800 dark:text-slate-100 mb-3 leading-snug">
                {activeContent.cards.card1.title}
              </h3>
              <p className="font-google text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                {activeContent.cards.card1.description}
              </p>
            </div>
            
            {/* SVG Wrapper */}
            <div className="w-full md:w-[55%] lg:w-full lg:h-[65%] aspect-[4/3] md:aspect-auto lg:aspect-auto flex items-center justify-center overflow-hidden">
              {activeTab === 'homeServices' ? (
                <img
                  src="/card_1_Services.svg"
                  alt="24/7 AI Support"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              ) : (
                <SupportChatSVG
                  userMsg={activeContent.cards.card1.userMsg}
                  botMsg={activeContent.cards.card1.botMsg}
                />
              )}
            </div>
          </div>

          {/* Card 2: Lead Capture & Scoring (SVG top, Text bottom) */}
          <div className="relative flex flex-col md:flex-row lg:flex-col rounded-[32px] p-6 sm:p-8 h-auto lg:h-[560px] xl:h-[600px] min-w-[300px] md:min-w-[680px] lg:min-w-0 bg-gradient-to-b from-white/95 to-amber-50/50 dark:from-[#231A12] dark:to-[#120D09] border border-amber-100 dark:border-amber-950/60 transition-all duration-500 shadow-sm overflow-hidden group gap-6 md:gap-8 lg:gap-0">
            {/* SVG Wrapper */}
            <div className="w-full md:w-[55%] lg:w-full lg:h-[65%] aspect-[4/3] md:aspect-auto lg:aspect-auto flex items-center justify-center overflow-hidden">
              <LeadScoreChatSVG
                userMsg={activeContent.cards.card2.userMsg}
                botMsg={activeContent.cards.card2.botMsg}
                badgeText={activeContent.cards.card2.badgeText}
                badgeColor={activeContent.cards.card2.badgeColor}
                leadDetail={activeContent.cards.card2.leadDetail}
              />
            </div>

            <div className="w-full md:w-[45%] lg:w-full lg:h-[35%] flex flex-col justify-end mt-4 md:mt-0 lg:mt-0">
              <h3 className="font-google font-semibold text-2xl text-slate-800 dark:text-slate-100 mb-3 leading-snug">
                {activeContent.cards.card2.title}
              </h3>
              <p className="font-google text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                {activeContent.cards.card2.description}
              </p>
            </div>
          </div>

          {/* Card 3: Conversion & ROI Analytics (Text top, SVG bottom) */}
          <div className="relative flex flex-col md:flex-row lg:flex-col rounded-[32px] p-6 sm:p-8 h-auto lg:h-[560px] xl:h-[600px] min-w-[300px] md:min-w-[680px] lg:min-w-0 bg-gradient-to-b from-white/95 to-emerald-50/50 dark:from-[#0E2018] dark:to-[#08130E] border border-emerald-100 dark:border-emerald-950/60 transition-all duration-500 shadow-sm overflow-hidden group gap-6 md:gap-8 lg:gap-0">
            <div className="w-full md:w-[45%] lg:w-full lg:h-[35%] flex flex-col justify-start mb-0 md:mb-0 lg:mb-0">
              <h3 className="font-google font-semibold text-2xl text-slate-800 dark:text-slate-100 mb-3 leading-snug">
                {activeContent.cards.card3.title}
              </h3>
              <p className="font-google text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                {activeContent.cards.card3.description}
              </p>
            </div>
            
            {/* SVG Wrapper */}
            <div className="w-full md:w-[55%] lg:w-full lg:h-[65%] aspect-[4/3] md:aspect-auto lg:aspect-auto flex items-center justify-center overflow-hidden">
              <ROIAnalyticsSVG
                conversionRate={activeContent.cards.card3.conversionRate}
                countText={activeContent.cards.card3.countText}
                countVal={activeContent.cards.card3.countVal}
                roiMultiplier={activeContent.cards.card3.roiMultiplier}
                revenueAdded={activeContent.cards.card3.revenueAdded}
              />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

export default FeatureCardsSection;

