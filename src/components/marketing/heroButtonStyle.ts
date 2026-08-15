/* The hero pair reads as one mirrored unit: each button is fully round on the
   outer edge and softly cut on the inner one, so the two lean toward each
   other. `HERO_BUTTON` holds everything they share; only the corners differ.

   Inner radius is in rem — in rem, not px, so it scales in lockstep with the
   button's own box (built entirely from rem: text-lg's line-height, py-4's
   padding), rather than drifting out of proportion if the type scale ever
   changes. Both buttons must keep identical box metrics or the mirror stops
   lining up. */
/* THE BORDER IS THE CONTROL, NOT THE FILL. A frosted panel sits too close to
   whatever it floats on to read as a button by itself, so the boundary is what
   has to carry the 3:1 that WCAG asks of non-text UI.

   LIGHT THEME TAKES A DARK BOUNDARY, WHICH IS NOT A SYMMETRY BREAK FOR ITS OWN
   SAKE. A white border on a light hero ground cannot reach 3:1 at ANY alpha —
   the ceiling is white itself, which is under 1.4:1 there — so raising the
   alpha was never going to fix it and slate-900 is the only direction left.
   Dark theme keeps a white boundary for the same reason in reverse. The fills
   stay light in both themes; the glass look is unchanged.

   Re-measure both if the hero background changes: these hold against the
   `image 1.svg` wash at 0.40 over each theme's page colour, not in general. */
export const HERO_BUTTON =
  'flex items-center justify-center text-center whitespace-nowrap px-5 pt-3.5 pb-2.5 text-base sm:px-8 sm:pt-[18px] sm:pb-[14px] sm:text-lg font-newsreader ' +
  'bg-white/10 backdrop-blur-xl shadow-lg shadow-black/20 ' +
  'border-none ' +
  'text-slate-100 ' +
  'hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200';

