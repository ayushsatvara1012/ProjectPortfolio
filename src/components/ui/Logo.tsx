import Image from 'next/image';

type LogoProps = {
  className?: string;
  style?: React.CSSProperties;
};

export default function Logo({ className, style }: LogoProps) {
  return (
    <Image
      src="/hero-spiral-2.svg"
      alt="Vaayu"
      width={50}
      height={50}
      className={className}
      style={style}
      priority
    />
  );
}
