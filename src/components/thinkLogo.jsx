import React from "react";

/**
 * ThinkingLogo
 * ─────────────
 * Orbit animation + "Thinking" text side-by-side, horizontally centred.
 * Every measurement — orbit size, logo size, font size, dot size, gap —
 * derives from a single `size` prop so nothing ever misaligns.
 *
 * Props:
 *   size        {number}  – diameter of the orbit wrap in px  (default: 160)
 *   showLabel   {boolean} – show "Thinking" + dots            (default: true)
 *   className   {string}  – extra class on root wrapper
 *   style       {object}  – extra styles on root wrapper
 */
const ThinkingLogo = ({
  size = 160,
  showLabel = true,
  className = "",
  style = {},
}) => {
  // All measurements are proportional to `size`
  const logoW = size * 0.94;          // SVG logo width
  const logoH = logoW / 2;            // logo viewBox is 400×200 (2:1)
  const gap = size * 0.10;          // gap between orbit and text
  const fontSize = size * 0.14;          // "Thinking" label
  const dotSize = size * 0.045;         // bouncing dot diameter
  const dotGap = size * 0.038;         // gap between dots

  const particles = [
    { s: size * 0.031, c: "#5730F5", t: "8%", l: "44%", a: "tl-fUp", d: "2.8s", dl: "0.0s" },
    { s: size * 0.019, c: "#0F2060", t: "16%", l: "66%", a: "tl-fDR", d: "3.1s", dl: "0.4s" },
    { s: size * 0.025, c: "#5730F5", t: "40%", l: "88%", a: "tl-fRight", d: "2.6s", dl: "0.8s" },
    { s: size * 0.019, c: "#0F2060", t: "10%", l: "22%", a: "tl-fDL", d: "2.9s", dl: "0.2s" },
    { s: size * 0.025, c: "#5730F5", t: "40%", l: "4%", a: "tl-fLeft", d: "3.2s", dl: "0.6s" },
    { s: size * 0.019, c: "#0F2060", t: "80%", l: "44%", a: "tl-fDown", d: "3.0s", dl: "1.5s" },
    { s: size * 0.025, c: "#5730F5", t: "78%", l: "22%", a: "tl-fDown", d: "2.5s", dl: "0.9s" },
    { s: size * 0.019, c: "#0F2060", t: "78%", l: "66%", a: "tl-fDown", d: "3.3s", dl: "0.3s" },
  ];

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        ...style,
      }}
    >
      <style>{`
        @keyframes tl-spinCW  { to { transform: rotate(360deg);  } }
        @keyframes tl-spinCCW { to { transform: rotate(-360deg); } }

        .tl-ring { position: absolute; border-radius: 50%; pointer-events: none; }
        .tl-ring-1 { width: 72%;  height: 72%;  border: 1.5px solid rgba(87,48,245,0.30); animation: tl-spinCW  4s   linear infinite; }
        .tl-ring-2 { width: 88%;  height: 88%;  border: 1.5px dashed rgba(87,48,245,0.16); animation: tl-spinCCW 6.5s linear infinite; }
        .tl-ring-3 { width: 99%;  height: 99%;  border: 1.5px dotted rgba(15,32,96,0.14);  animation: tl-spinCW  10s  linear infinite; }

        .tl-dot-orbit { position: absolute; width: 72%; height: 72%; animation: tl-spinCW 4s linear infinite; }
        .tl-dot-orbit .tl-d { position: absolute; border-radius: 50%; }
        .tl-dot-orbit .tl-d:nth-child(1) { background: #5730F5; top: -3px; left: calc(50% - 3px); }
        .tl-dot-orbit .tl-d:nth-child(2) { background: #0F2060; bottom: -3px; left: calc(50% - 3px); }

        .tl-tri-orbit { position: absolute; width: 88%; height: 88%; animation: tl-spinCCW 6.5s linear infinite; }
        .tl-tri-orbit::before {
          content: '';
          position: absolute;
          top: -6px; left: calc(50% - 4px);
          width: 0; height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 8px solid rgba(87,48,245,0.55);
        }

        @keyframes tl-halo {
          0%,100% { transform: scale(0.85); opacity: 0.45; }
          50%     { transform: scale(1.12); opacity: 0.12; }
        }
        .tl-halo {
          position: absolute;
          width: 55%; height: 30%;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(87,48,245,0.28) 0%, transparent 70%);
          animation: tl-halo 2.4s ease-in-out infinite;
          z-index: 1;
          pointer-events: none;
        }

        @keyframes tl-fUp    { 0%{opacity:0;transform:translateY(0) scale(1)}    15%{opacity:0.9} 100%{opacity:0;transform:translateY(-40px) scale(0.3)} }
        @keyframes tl-fDown  { 0%{opacity:0;transform:translateY(0) scale(1)}    15%{opacity:0.9} 100%{opacity:0;transform:translateY(40px)  scale(0.3)} }
        @keyframes tl-fLeft  { 0%{opacity:0;transform:translateX(0) scale(1)}    15%{opacity:0.9} 100%{opacity:0;transform:translateX(-40px) scale(0.3)} }
        @keyframes tl-fRight { 0%{opacity:0;transform:translateX(0) scale(1)}    15%{opacity:0.9} 100%{opacity:0;transform:translateX(40px)  scale(0.3)} }
        @keyframes tl-fDR    { 0%{opacity:0;transform:translate(0,0) scale(1)}   15%{opacity:0.9} 100%{opacity:0;transform:translate(30px,-30px)  scale(0.3)} }
        @keyframes tl-fDL    { 0%{opacity:0;transform:translate(0,0) scale(1)}   15%{opacity:0.9} 100%{opacity:0;transform:translate(-30px,-30px) scale(0.3)} }
        .tl-particle { position: absolute; border-radius: 50%; opacity: 0; pointer-events: none; }

        @keyframes tl-scan {
          0%   { transform: translateX(0px);  }
          15%  { transform: translateX(-3px); }
          40%  { transform: translateX(-3px); }
          65%  { transform: translateX(3px);  }
          85%  { transform: translateX(3px);  }
          100% { transform: translateX(0px);  }
        }
        .tl-eye-l { transform-origin: 165px 108px; animation: tl-scan 3.4s cubic-bezier(0.4,0,0.2,1) infinite; }
        .tl-eye-r { transform-origin: 231px 108px; animation: tl-scan 3.4s cubic-bezier(0.4,0,0.2,1) infinite 0.08s; }

        @keyframes tl-db {
          0%,80%,100% { transform: translateY(0);    opacity: 0.3; }
          40%         { transform: translateY(-30%); opacity: 1;   }
        }
        .tl-td-1 { animation: tl-db 1.3s ease-in-out infinite 0.00s; }
        .tl-td-2 { animation: tl-db 1.3s ease-in-out infinite 0.15s; }
        .tl-td-3 { animation: tl-db 1.3s ease-in-out infinite 0.30s; }
      `}</style>

      {/* ── Orbit wrap ── */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="tl-halo" />
        <div className="tl-ring tl-ring-1" />
        <div className="tl-ring tl-ring-2" />
        <div className="tl-ring tl-ring-3" />

        {/* Orbiting dots */}
        <div className="tl-dot-orbit">
          <div className="tl-d" style={{ width: size * 0.038, height: size * 0.038 }} />
          <div className="tl-d" style={{ width: size * 0.038, height: size * 0.038 }} />
        </div>

        {/* Orbiting triangle */}
        <div className="tl-tri-orbit" />

        {/* Particles */}
        <div style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }}>
          {particles.map((p, i) => (
            <div
              key={i}
              className="tl-particle"
              style={{
                width: p.s, height: p.s,
                background: p.c,
                top: p.t, left: p.l,
                animation: `${p.a} ${p.d} ease-out infinite ${p.dl}`,
              }}
            />
          ))}
        </div>

        {/* Logo SVG — centered, proportional */}
        <svg
          viewBox="0 0 400 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: "absolute", width: logoW, height: logoH, zIndex: 2 }}
        >
          <path opacity=".45" d="M128 104H124C122.895 104 122 104.895 122 106V110C122 111.105 122.895 112 124 112H128C129.105 112 130 111.105 130 110V106C130 104.895 129.105 104 128 104Z" fill="#5730F5" />
          <path opacity=".45" d="M276 104H272C270.895 104 270 104.895 270 106V110C270 111.105 270.895 112 272 112H276C277.105 112 278 111.105 278 110V106C278 104.895 277.105 104 276 104Z" fill="#5730F5" />
          <path opacity=".4" d="M128 146H124C123.448 146 123 146.448 123 147V151C123 151.552 123.448 152 124 152H128C128.552 152 129 151.552 129 151V147C129 146.448 128.552 146 128 146Z" fill="#0F2060" />
          <path opacity=".4" d="M276 146H272C271.448 146 271 146.448 271 147V151C271 151.552 271.448 152 272 152H276C276.552 152 277 151.552 277 151V147C277 146.448 276.552 146 276 146Z" fill="#0F2060" />
          <path opacity=".45" d="M201 44H198C196.895 44 196 44.8954 196 46V49C196 50.1046 196.895 51 198 51H201C202.105 51 203 50.1046 203 49V46C203 44.8954 202.105 44 201 44Z" fill="#5730F5" />
          <path d="M148 77H138C135.791 77 134 78.7909 134 81V91C134 93.2091 135.791 95 138 95H148C150.209 95 152 93.2091 152 91V81C152 78.7909 150.209 77 148 77Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M170 59H160C157.791 59 156 60.7909 156 63V73C156 75.2091 157.791 77 160 77H170C172.209 77 174 75.2091 174 73V63C174 60.7909 172.209 59 170 59Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M258 99H248C245.791 99 244 100.791 244 103V113C244 115.209 245.791 117 248 117H258C260.209 117 262 115.209 262 113V103C262 100.791 260.209 99 258 99Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M258 77H248C245.791 77 244 78.7909 244 81V91C244 93.2091 245.791 95 248 95H258C260.209 95 262 93.2091 262 91V81C262 78.7909 260.209 77 258 77Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M148 99H138C135.791 99 134 100.791 134 103V113C134 115.209 135.791 117 138 117H148C150.209 117 152 115.209 152 113V103C152 100.791 150.209 99 148 99Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M236 59H226C223.791 59 222 60.7909 222 63V73C222 75.2091 223.791 77 226 77H236C238.209 77 240 75.2091 240 73V63C240 60.7909 238.209 59 236 59Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M192 77H182C179.791 77 178 78.7909 178 81V91C178 93.2091 179.791 95 182 95H192C194.209 95 196 93.2091 196 91V81C196 78.7909 194.209 77 192 77Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M214 77H204C201.791 77 200 78.7909 200 81V91C200 93.2091 201.791 95 204 95H214C216.209 95 218 93.2091 218 91V81C218 78.7909 216.209 77 214 77Z" fill="#0F2060" className="dark:fill-white" />
          {/* Left eye socket */}
          <path d="M170 99H160C157.791 99 156 100.791 156 103V113C156 115.209 157.791 117 160 117H170C172.209 117 174 115.209 174 113V103C174 100.791 172.209 99 170 99Z" fill="#0F2060" className="dark:fill-white" />
          {/* Left iris — scan only */}
          <path className="tl-eye-l" d="M168 101H162C160.343 101 159 102.343 159 104V112C159 113.657 160.343 115 162 115H168C169.657 115 171 113.657 171 112V104C171 102.343 169.657 101 168 101Z" fill="#5730F5" />
          {/* Right eye socket */}
          <path d="M236 100H226C223.791 100 222 101.791 222 104V114C222 116.209 223.791 118 226 118H236C238.209 118 240 116.209 240 114V104C240 101.791 238.209 100 236 100Z" fill="#0F2060" className="dark:fill-white" />
          {/* Right iris — scan only */}
          <path className="tl-eye-r" d="M234 102H228C226.343 102 225 103.343 225 105V113C225 114.657 226.343 116 228 116H234C235.657 116 237 114.657 237 113V105C237 103.343 235.657 102 234 102Z" fill="#5730F5" />
          <path d="M192 121H182C179.791 121 178 122.791 178 125V135C178 137.209 179.791 139 182 139H192C194.209 139 196 137.209 196 135V125C196 122.791 194.209 121 192 121Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M214 121H204C201.791 121 200 122.791 200 125V135C200 137.209 201.791 139 204 139H214C216.209 139 218 137.209 218 135V125C218 122.791 216.209 121 214 121Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M170 137H160C157.791 137 156 138.791 156 141V151C156 153.209 157.791 155 160 155H170C172.209 155 174 153.209 174 151V141C174 138.791 172.209 137 170 137Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M236 137H226C223.791 137 222 138.791 222 141V151C222 153.209 223.791 155 226 155H236C238.209 155 240 153.209 240 151V141C240 138.791 238.209 137 236 137Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M148 121H138C135.791 121 134 122.791 134 125V135C134 137.209 135.791 139 138 139H148C150.209 139 152 137.209 152 135V125C152 122.791 150.209 121 148 121Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M258 121H248C245.791 121 244 122.791 244 125V135C244 137.209 245.791 139 248 139H258C260.209 139 262 137.209 262 135V125C262 122.791 260.209 121 258 121Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M192 99H182C179.791 99 178 100.791 178 103V113C178 115.209 179.791 117 182 117H192C194.209 117 196 115.209 196 113V103C196 100.791 194.209 99 192 99Z" fill="#0F2060" className="dark:fill-white" />
          <path d="M213 99H203C200.791 99 199 100.791 199 103V113C199 115.209 200.791 117 203 117H213C215.209 117 217 115.209 217 113V103C217 100.791 215.209 99 213 99Z" fill="#0F2060" className="dark:fill-white" />
          <g transform="matrix(1 0 0 1.802319 0 -139.202346)">
            <path d="M249.811,171c-26.284853,1.656625-60.541601,4.781331-99.622,0-.421,0-.762,1.119-.762,2.5s.341,2.5.762,2.5h99.622c.421,0,.762-1.119.762-2.5s-.341-2.5-.762-2.5Z" transform="matrix(1 0 0 0.999999 -1 0.000174)" fill="#0F2060" className="dark:fill-white" />
            <path d="M150.237,171h-1.619c-.893,0-1.618.895-1.618,2v1c0,1.105.725,2,1.618,2h1.619c.893,0,1.618-.895,1.618-2v-1c0-1.105-.725-2-1.618-2Z" fill="#5730F5" />
            <path d="M251.382,171h-1.619c-.893,0-1.618.895-1.618,2v1c0,1.105.725,2,1.618,2h1.619c.893,0,1.618-.895,1.618-2v-1c0-1.105-.725-2-1.618-2Z" fill="#5730F5" />
          </g>
        </svg>
      </div>

      {/* ── Text side — all values derived from `size` ── */}
      {showLabel && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: size * 0.06,
          }}
        >
          {/* "Thinking" label */}
          <span
            style={{
              fontSize,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Thinking
          </span>

          {/* Bouncing dots */}
          <div style={{ display: "flex", alignItems: "center", gap: dotGap }}>
            {["tl-td-1", "tl-td-2", "tl-td-3"].map((cls) => (
              <div
                key={cls}
                className={cls}
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: "#5730F5",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingLogo;

/*
─── Usage ────────────────────────────────────────────────

  // Default (160px orbit, ~22px font, ~7px dots)
  {isThinking && <ThinkingLogo />}

  // Smaller — everything scales down together
  {isThinking && <ThinkingLogo size={80} />}

  // Larger — everything scales up together
  {isThinking && <ThinkingLogo size={240} />}

  // No label
  {isThinking && <ThinkingLogo showLabel={false} />}

  // Centred in a panel
  {isThinking && (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <ThinkingLogo size={160} />
    </div>
  )}
*/