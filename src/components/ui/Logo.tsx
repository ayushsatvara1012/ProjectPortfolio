import Image from 'next/image';

type LogoProps = {
  className?: string;
  style?: React.CSSProperties;
};

export default function Logo({ className, style }: LogoProps) {
  return (
    <Image
      src="/new_brand.svg"
      alt="Vaayu"
      width={60}
      height={60}
      className={className}
      style={style}
      priority
    />
  );
}
