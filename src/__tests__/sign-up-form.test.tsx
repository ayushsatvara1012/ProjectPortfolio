import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignUpForm from '@/src/app/(app)/(auth)/_components/SignUpForm';

const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockSetActive = vi.fn();
let mockSignUp: Record<string, unknown>;

vi.mock('@clerk/nextjs/legacy', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: mockSignUp, setActive: mockSetActive }),
}));

vi.mock('@clerk/nextjs/errors', () => ({
  isClerkAPIResponseError: () => false,
}));

describe('SignUpForm — resumed Google OAuth needing legal consent', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockCreate.mockReset();
    mockSetActive.mockReset();
    mockSignUp = {
      status: 'missing_requirements',
      missingFields: ['legal_accepted'],
      emailAddress: 'oauth-user@example.com',
      create: mockCreate,
      update: mockUpdate,
      authenticateWithRedirect: vi.fn(),
    };
  });

  it('shows the consent-only screen instead of the email/password form', () => {
    render(<SignUpForm />);
    expect(screen.getByText('Almost done')).toBeTruthy();
    expect(screen.getByText('oauth-user@example.com')).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.getByRole('button', { name: /complete sign up/i })).toBeDisabled();
  });

  it('calls signUp.update({ legalAccepted: true }) and activates the session once checked', async () => {
    mockUpdate.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_123' });
    render(<SignUpForm />);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /complete sign up/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ legalAccepted: true }));
    expect(mockCreate).not.toHaveBeenCalled();
    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_123' }));
  });

  it('shows an error instead of activating a session when still incomplete', async () => {
    mockUpdate.mockResolvedValue({ status: 'missing_requirements', createdSessionId: null });
    render(<SignUpForm />);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /complete sign up/i }));

    await waitFor(() => expect(screen.getByText('Unable to complete sign up. Please try again.')).toBeTruthy());
    expect(mockSetActive).not.toHaveBeenCalled();
  });
});

describe('SignUpForm — fresh email/password sign-up (no resumed attempt)', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockCreate.mockReset();
    mockSetActive.mockReset();
    mockSignUp = {
      status: null,
      missingFields: [],
      emailAddress: null,
      create: mockCreate,
      update: mockUpdate,
      authenticateWithRedirect: vi.fn(),
    };
  });

  it('renders the normal create-account form, not the resumed-OAuth screen', () => {
    render(<SignUpForm />);
    expect(screen.queryByText('Almost done')).toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });
});
