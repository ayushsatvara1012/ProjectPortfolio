'use client';

import React from 'react';
import { SignUpButton } from '@clerk/nextjs';
import { HERO_BUTTON } from './heroButtonStyle';

export function GetStartedButton() {
  return (
    <SignUpButton mode="redirect">
      <button className={`${HERO_BUTTON} cursor-pointer rounded-r-md rounded-l-4xl`}>
        Sign up
      </button>
    </SignUpButton>
  );
}
