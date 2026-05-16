import Image from 'next/image';

type LogoProps = {
  className?: string;
  style?: React.CSSProperties;
};

export default function Logo({ className, style }: LogoProps) {
  return (
    <Image
      src="/logo2.svg"
      alt="Logo"
      width={62}
      height={46}
      className={className}
      style={style}
      priority
    />
  );
}
