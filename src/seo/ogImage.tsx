import { ImageResponse } from 'next/og';

// Shared renderer for the file-based `opengraph-image` and `twitter-image`
// conventions. Generates a real 1200x630 PNG so social platforms (X, LinkedIn,
// Facebook, Slack, iMessage) — which do not render SVG previews — get a valid
// card. The on-page logo and favicon stay as /logo2.svg; this is the raster
// companion built from that same mark.

export const alt = 'Vaayu by Sapybase — A Business Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Inlined from public/vaayu_logo.svg so the renderer needs no filesystem/network
// access and works on any runtime. Keep in sync if the product mark changes.
const logoSvg = `<svg width="36" height="23" viewBox="0 0 36 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.902634 0.430403L6.27567 11.6987L9.8577 4.1865L10.5408 14.2424L15.2307 6.33284L18.8128 15.4548L22.3948 5.25967V22.4304L28.6633 6.33284L31.2898 14.2424L34.9026 4.1865" stroke="url(#paint0_linear_251_43)" stroke-width="2"/><defs><linearGradient id="paint0_linear_251_43" x1="18.365" y1="3.11333" x2="18.4026" y2="17.9304" gradientUnits="userSpaceOnUse"><stop stop-color="#004DE8"/><stop offset="1" stop-color="#002B82"/></linearGradient></defs></svg>`;

const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#06163a',
          backgroundImage:
            'radial-gradient(circle at 28% 18%, #163e96 0%, transparent 55%), radial-gradient(circle at 78% 88%, #0a2466 0%, transparent 50%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 176,
            height: 176,
            borderRadius: 42,
            backgroundColor: 'white',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 24px 64px rgba(2, 10, 35, 0.55)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={120} height={77} alt="" />
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 92,
            fontWeight: 700,
            marginTop: 52,
            letterSpacing: -2,
          }}
        >
          Vaayu
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 38,
            color: '#aac0ee',
            marginTop: 14,
            fontWeight: 500,
          }}
        >
          A Business Intelligence · by Sapybase
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 26,
            color: '#5f78b4',
            marginTop: 44,
            letterSpacing: 6,
          }}
        >
          SAPYBASE.COM
        </div>
      </div>
    ),
    { ...size },
  );
}
