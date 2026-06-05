import { PRODUCT } from '@/src/lib/brand';
import VaayuLogo from './VaayuLogo';

type VaayuLockupProps = {
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  /** Layout of the "by Sapybase" endorsement relative to the wordmark. */
  endorsement?: 'inline' | 'stacked' | 'none';
};

/**
 * Endorsed lockup: "Vaayu by Sapybase" (Anthropic ⇄ Claude style).
 *
 * Use wherever the PRODUCT is presented and we want to signal the maker:
 * product marketing headers, the dashboard/console chrome, footer.
 * For pure corporate surfaces (legal, about, founder) use the Sapybase
 * <Logo /> instead — not this.
 */
export default function VaayuLockup({
  className,
  style,
  size = 28,
  endorsement = 'inline',
}: VaayuLockupProps) {
  const stacked = endorsement === 'stacked';
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'flex-start' : 'baseline',
        gap: stacked ? size * 0.12 : size * 0.28,
        ...style,
      }}
    >
      <VaayuLogo size={size} />
      {endorsement !== 'none' && (
        <span
          style={{
            fontSize: size * 0.42,
            fontWeight: 400,
            opacity: 0.7,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {PRODUCT.endorsement}
        </span>
      )}
    </span>
  );
}
