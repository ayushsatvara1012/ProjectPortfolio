import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const ArrowRightIcon = ({ size = 24, className = '', ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M21 12.5L12.3125 21L11.5545 20.2584L18.948 13.0245H3V11.9755H18.948L11.5545 4.74162L12.3125 4L21 12.5Z"
      fill="currentColor"
    />
  </svg>
);
