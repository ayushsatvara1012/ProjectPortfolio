import Image from 'next/image';

type LogoProps = {
  className?: string;
  style?: React.CSSProperties;
};

export default function Logo({ className, style }: LogoProps) {
  return (
    <Image
      src="/Vector.png"
      alt="Vaayu"
      width={80}
      height={80}
      className={className}
      style={style}
      priority
    />
  );
}
