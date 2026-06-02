import { ImageResponse } from 'next/og';

// Shared renderer for the file-based `opengraph-image` and `twitter-image`
// conventions. Generates a real 1200x630 PNG so social platforms (X, LinkedIn,
// Facebook, Slack, iMessage) — which do not render SVG previews — get a valid
// card. The on-page logo and favicon stay as /logo2.svg; this is the raster
// companion built from that same mark.

export const alt = 'Sapybase — AI Chatbot That Knows Your Business';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Inlined from public/logo2.svg so the renderer needs no filesystem/network
// access and works on any runtime. Keep in sync if the brand mark changes.
const logoSvg = `<svg width="42" height="36" viewBox="0 0 42 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.0552 0.00270519C13.1849 0.00283429 13.3105 0.0112098 13.4321 0.0271902C14.2595 0.135962 15.1803 0.193207 16.0143 0.165289C16.0459 0.164234 16.0777 0.163672 16.1097 0.163613L20.6497 0.156149C20.8929 0.155749 21.1166 0.288815 21.2324 0.502654C21.348 0.716149 21.5712 0.849159 21.814 0.849159H22.6266C22.8043 0.849159 22.9176 0.659449 22.8333 0.503006C22.7491 0.346563 22.8624 0.156852 23.0401 0.156852H30.1711V1.54147H28.3191C26.8054 1.54147 25.8403 3.15782 26.5585 4.4903L33.6306 17.6129C33.9476 18.2012 33.9499 18.9088 33.6367 19.4991L26.7737 32.4343C26.2589 33.4047 26.9099 34.6112 27.9491 34.6127L30.811 34.6154C31.2362 34.6156 31.633 34.4017 31.8875 34.0448L31.9878 33.8839L39.6772 19.4738C39.9938 18.8805 39.991 18.1676 39.6697 17.5768L31.3411 2.26217C31.1283 1.87112 30.7601 1.61216 30.3487 1.55364L30.1711 1.54147V0.156852C31.1976 0.157023 32.093 0.741501 32.5613 1.60231L41.4041 17.8625C41.6262 18.2709 41.6284 18.7634 41.41 19.1737L33.2133 34.5343C32.748 35.4062 31.8457 36.0008 30.8097 36L27.9478 35.9973C27.8676 35.9972 27.7889 35.994 27.7118 35.9877C26.8841 35.9207 25.9673 35.9222 25.1397 35.9902C25.061 35.9967 24.9807 36 24.8988 36H20.4034C20.1589 36 19.9327 35.8658 19.8139 35.6521C19.6962 35.4406 19.4722 35.3077 19.2302 35.3077H18.4908C18.3132 35.3077 18.201 35.4987 18.2876 35.6538C18.3742 35.809 18.2621 36 18.0844 36H10.8359C9.80567 35.9999 8.90727 35.4105 8.4404 34.5451L0.242699 19.4568C-0.0609418 18.8979 -0.080661 18.2279 0.189584 17.6522L7.75847 1.52659L7.77474 1.49279L7.79101 1.46034C8.25732 0.591206 9.15834 -0.000823797 10.192 8.60427e-07L13.0552 0.00270519ZM10.1906 1.38462C9.70585 1.38433 9.25739 1.66207 9.01522 2.11343L1.74323 17.6075C1.47299 18.1833 1.49274 18.8533 1.79643 19.4122L9.66325 33.8893C9.90567 34.3386 10.3527 34.6153 10.8359 34.6154H12.712C14.2388 34.6154 15.2025 32.9736 14.4582 31.6404L7.66554 19.4738C7.33467 18.8812 7.32873 18.1616 7.63862 17.5577C10.2408 12.487 11.7383 8.26103 14.2293 3.56566C14.7118 2.65563 14.1701 1.53758 13.2437 1.40084L13.0539 1.38732L10.1906 1.38462ZM29.2736 15.3552C30.216 17.0958 29.1468 19.5874 26.8808 19.5874H23.5186C22.488 19.5873 21.5897 18.9971 21.1231 18.1312L16.4017 9.36915C15.6312 7.93922 13.5874 7.98539 12.9212 9.46683C12.6322 10.1096 12.3455 10.7561 12.0547 11.4109C11.19 13.3584 10.2895 15.3725 9.19975 17.5401C8.89786 18.1406 8.90735 18.8521 9.23499 19.4389L17.1303 33.5802C17.2484 33.7919 17.4719 33.9231 17.7144 33.9231C18.2247 33.9231 18.5471 33.3747 18.2989 32.9288L11.5152 20.7395C10.5468 18.9992 11.61 16.4792 13.8917 16.4788V17.8634L13.6992 17.877C12.7627 18.0163 12.2224 19.1574 12.7285 20.0675L20.2531 33.588C20.606 34.2222 21.2748 34.6154 22.0006 34.6154H24.8988L25.0886 34.6019C26.0167 34.4656 26.5597 33.3448 26.0742 32.4343L18.6869 18.595C18.4755 18.1991 18.106 17.9354 17.6918 17.8756L17.5115 17.8634V16.4788C18.5465 16.479 19.4474 17.0734 19.9124 17.9446L24.6513 26.8215C25.4056 28.2345 27.4319 28.2318 28.1824 26.8169L32.0628 19.5018C32.3759 18.9115 32.3736 18.2039 32.0566 17.6157L23.9655 2.60263C23.8431 2.37543 23.6058 2.23377 23.3477 2.23377C22.816 2.23377 22.4774 2.8021 22.7306 3.26971L29.2736 15.3552ZM16.1124 1.54823C15.0692 1.55015 14.4182 2.76585 14.941 3.73603L22.346 17.4754C22.558 17.8688 22.9269 18.1301 23.3397 18.1893L23.5186 18.2028H26.8808L27.072 18.188C27.9411 18.0598 28.4716 17.0694 28.1376 16.1976L28.0521 16.0137L20.7858 2.59128C20.4357 1.94462 19.759 1.54222 19.0237 1.54343L16.1124 1.54823ZM17.5115 16.4788V17.8634H13.8917V16.4788H17.5115Z" fill="url(#paint0_linear_238_39)"/><defs><linearGradient id="paint0_linear_238_39" x1="20.7489" y1="1.38462" x2="20.7489" y2="34.6154" gradientUnits="userSpaceOnUse"><stop offset="0.25" stop-color="#004DE8"/><stop offset="0.75" stop-color="#002B82"/></linearGradient></defs></svg>`;

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
          <img src={logoSrc} width={100} height={86} alt="" />
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
          Sapybase
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
          AI Chatbot That Knows Your Business
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
