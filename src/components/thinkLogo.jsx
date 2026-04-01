import React from "react";

/**
 * ThinkingLogo
 * ─────────────
 * 4 Pixel Blocks loader — color shimmer only, no scale/movement.
 */
const ThinkingLogo = ({
  size = 154,
  showLabel = false,
  className = "",
  style = {},
  themeColor = "#0F2060",
}) => {
  // Derive a lighter shade for alternating blocks
  const primaryColor = themeColor;
  const secondaryColor = themeColor + 'CC'; // 80% opacity variant

  const width = size;
  const height = size * (41 / 154);

  const blocks = [
    { x: 6,     color: primaryColor,   delay: "0.00s", dur: "1.5s" },
    { x: 43.6,  color: secondaryColor, delay: "0.25s", dur: "1.7s" },
    { x: 81.2,  color: secondaryColor, delay: "0.50s", dur: "1.5s" },
    { x: 118.8, color: primaryColor,   delay: "0.75s", dur: "1.6s" },
  ];

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        ...style,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 154 41"
        width={width}
        height={height}
        style={{ flexShrink: 0 }}
      >
        {blocks.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y="6"
            width="28.8"
            height="28.8"
            rx="4"
            fill={b.color}
          >
            {/* Shimmer: fade between dim and full opacity, no transform */}
            <animate
              attributeName="opacity"
              values="0.15;0.15;1;0.15;0.15"
              keyTimes="0;0.01;0.5;0.99;1"
              dur={b.dur}
              begin={b.delay}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
            />
          </rect>
        ))}
      </svg>

      {showLabel && (
        <span
          className="dark:text-slate-200"
          style={{
            fontSize: size * 0.14,
            fontWeight: 500,
            color: "var(--color-text-primary, #0F2060)",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          Thinking
        </span>
      )}
    </div>
  );
};

export default ThinkingLogo;