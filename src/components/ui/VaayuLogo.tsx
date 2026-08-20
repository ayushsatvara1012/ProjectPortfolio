import Image from 'next/image';
import { PRODUCT } from '@/src/lib/brand';

type VaayuLogoProps = {
  className?: string;
  style?: React.CSSProperties;
  /** Wordmark height in px (mark scales with it). */
  size?: number;
  /** Show only the mark without the "Vaayu" wordmark. */
  iconOnly?: boolean;
};

// Intrinsic aspect ratio of /public/hero-spiral-brand.svg (508 × 506).
const MARK_RATIO = 508 / 506;

/**
 * Vaayu product logo — the real mark from /public/vaayu_logo.svg plus the
 * "Vaayu" wordmark (the SVG is a glyph only, no text). Everything reads
 * PRODUCT.name / PRODUCT.logo from brand.ts, so swapping the asset or name
 * is a one-line change there.
 */
export default function VaayuLogo({
  className,
  style,
  size = 28,
  iconOnly = false,
}: VaayuLogoProps) {
  const markHeight = Math.round(size * 0.82);
  const markWidth = Math.round(markHeight * MARK_RATIO);
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, ...style }}
      aria-label={PRODUCT.name}
    >
      <Image
        src={PRODUCT.logo}
        alt={iconOnly ? PRODUCT.name : ''}
        width={markWidth}
        height={markHeight}
        priority
      />
      {!iconOnly && (
        <span
          style={{
            fontSize: size * 0.82,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          {PRODUCT.name}
        </span>
      )}
    </span>
  );
}
