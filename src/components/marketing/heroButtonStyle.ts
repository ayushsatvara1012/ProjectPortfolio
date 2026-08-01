/* The hero pair reads as one mirrored unit: each button is fully round on the
   outer edge and softly cut on the inner one, so the two lean toward each
   other. `HERO_BUTTON` holds everything they share; only the corners differ.

   Inner radius is in rem — in rem, not px, so it scales in lockstep with the
   button's own box (built entirely from rem: text-lg's line-height, py-4's
   padding), rather than drifting out of proportion if the type scale ever
   changes. Both buttons must keep identical box metrics or the mirror stops
   lining up. */
export const HERO_BUTTON =
  'flex items-center justify-center text-center whitespace-nowrap px-5 py-3 text-base sm:px-8 sm:py-4 sm:text-lg font-newsreader ' +
  'border border-slate-200 dark:border-white/15 ' +
  'text-slate-900 dark:text-slate-100 ' +
  'hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-colors';
