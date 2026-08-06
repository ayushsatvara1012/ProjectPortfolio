/* The hero pair reads as one mirrored unit: each button is fully round on the
   outer edge and softly cut on the inner one, so the two lean toward each
   other. `HERO_BUTTON` holds everything they share; only the corners differ.

   Inner radius is in rem — in rem, not px, so it scales in lockstep with the
   button's own box (built entirely from rem: text-lg's line-height, py-4's
   padding), rather than drifting out of proportion if the type scale ever
   changes. Both buttons must keep identical box metrics or the mirror stops
   lining up. */
export const HERO_BUTTON =
  'flex items-center justify-center text-center whitespace-nowrap px-5 pt-3.5 pb-2.5 text-base sm:px-8 sm:pt-[18px] sm:pb-[14px] sm:text-lg font-newsreader ' +
  'bg-white/40 dark:bg-white/10 backdrop-blur-md shadow-sm ' +
  'border border-white/50 dark:border-white/15 ' +
  'text-slate-900 dark:text-slate-100 ' +
  'hover:bg-white/60 dark:hover:bg-white/20 transition-all';
