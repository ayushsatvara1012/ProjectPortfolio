import React from 'react';
import PixelField from './PixelField';

/* Drawn in code rather than shipped as an image so it stays sharp at any
   viewport, follows the theme without a second asset, and costs no bytes.
   Three layers, back to front: the pixel field, a brand-blue glow behind the
   headline, and a wash that keeps the copy's contrast off the field. */

const FIELD_FADE =
  'radial-gradient(ellipse 95% 75% at 50% 30%, #000 45%, transparent 100%)';

export default function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ maskImage: FIELD_FADE, WebkitMaskImage: FIELD_FADE }}
      >
        <PixelField className="absolute inset-0" />
      </div>

      <div
        className="absolute -top-40 left-1/2 h-[42rem] w-[80rem] -translate-x-1/2 rounded-full blur-3xl opacity-[0.10] dark:opacity-[0.18]"
        style={{
          background:
            'radial-gradient(closest-side, #004DE8 0%, #3B82F6 45%, transparent 100%)',
        }}
      />

      <div className="absolute inset-0 bg-[#FAFAFC]/30 dark:bg-black/40" />
    </div>
  );
}
