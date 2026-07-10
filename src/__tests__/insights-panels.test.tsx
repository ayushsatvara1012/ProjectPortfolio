import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import SalesAndLeadsPanel from '@/src/components/dashboard/SalesAndLeadsPanel';
import ActionCenterPanel from '@/src/components/dashboard/ActionCenterPanel';

// Mock react-query
vi.mock('@tanstack/react-query', () => {
  const mutateFn = vi.fn();
  return {
    useQuery: vi.fn(() => ({
      data: { queue: [], counts: { total: 0 } },
      isLoading: false,
      isError: false,
    })),
    useMutation: vi.fn(() => ({
      mutate: mutateFn,
      isPending: false,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
    })),
  };
});

// Mock UpgradePrompt
vi.mock('@/src/components/features/UpgradePrompt', () => ({
  default: ({ code }: any) => <div data-testid="upgrade-prompt">Upgrade Prompt: {code}</div>,
}));

// Mock LeadsPanel to isolate testing of SalesAndLeadsPanel
vi.mock('@/src/components/dashboard/LeadsPanel', () => ({
  default: () => <div data-testid="leads-panel">CRM Leads Table</div>,
}));

// Mock ROIPanel to isolate testing
vi.mock('@/src/components/dashboard/ROIPanel', () => ({
  default: () => <div data-testid="roi-panel">ROI Financial Impact</div>,
}));

describe('SalesAndLeadsPanel & ActionCenterPanel Consolidated UX', () => {
  const mockAuthFetch = vi.fn();
  const mockSelectedBot = { id: 'bot-123', bot_name: 'Vaayu Bot', company_name: 'SapyAI' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SalesAndLeadsPanel Entitlements Gating', () => {
    it('renders ROI panel but gates Lead Capture features when canUseLeadCapture is false', () => {
      render(
        <SalesAndLeadsPanel
          selectedBotId="bot-123"
          authFetch={mockAuthFetch}
          entitlements={{ canUseAnalytics: true, canUseLeadCapture: false }}
          selectedBot={mockSelectedBot}
        />
      );

      // ROI Panel should render normally
      expect(screen.getByTestId('roi-panel')).toBeInTheDocument();

      // Lead Capture/CRM segments must be replaced with the Upgrade Prompt
      expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
      expect(screen.queryByTestId('leads-panel')).not.toBeInTheDocument();
      expect(screen.queryByText('Action Queue')).not.toBeInTheDocument();
    });

    it('renders all sections normally when canUseLeadCapture is true', () => {
      render(
        <SalesAndLeadsPanel
          selectedBotId="bot-123"
          authFetch={mockAuthFetch}
          entitlements={{ canUseAnalytics: true, canUseLeadCapture: true }}
          selectedBot={mockSelectedBot}
        />
      );

      expect(screen.getByTestId('roi-panel')).toBeInTheDocument();
      expect(screen.getByTestId('leads-panel')).toBeInTheDocument();
      // UpgradePrompt should not render
      expect(screen.queryByTestId('upgrade-prompt')).not.toBeInTheDocument();
    });
  });

  describe('ActionCenterPanel Won Deals Transition Flow', () => {
    it('decouples "Won" click from immediate mutation to capture deal value', () => {
      const mockMutate = vi.fn();
      vi.mocked(useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      // Mock queue data
      const mockQueue = [
        {
          id: 'lead-1',
          email: 'customer@example.com',
          name: 'Jane Doe',
          context: 'pricing questions',
          score: 85,
          band: 'HOT',
          status: 'new',
          age_hours: 2,
          urgency: 'high',
          reason: 'Intent detected',
        },
      ];

      vi.mocked(useQuery).mockReturnValue({
        data: { queue: mockQueue, counts: { total: 1, high: 1, medium: 0, low: 0 } },
        isLoading: false,
        isError: false,
      } as any);

      render(
        <ActionCenterPanel
          selectedBotId="bot-123"
          authFetch={mockAuthFetch}
          isAuthorized={true}
          selectedBot={mockSelectedBot}
        />
      );

      // Find the Won button and click it
      const wonButton = screen.getByRole('button', { name: 'Won' });
      fireEvent.click(wonButton);

      // The mutation should NOT be fired yet (decoupled state transition)
      expect(mockMutate).not.toHaveBeenCalled();

      // Instead, a "Deal Value" input and "Save" / "Skip" buttons should be shown
      const dealInput = screen.getByPlaceholderText('Deal Value');
      expect(dealInput).toBeInTheDocument();

      // Type a value and click Save
      fireEvent.change(dealInput, { target: { value: '250' } });
      const saveButton = screen.getByRole('button', { name: 'Save' });
      fireEvent.click(saveButton);

      // Mutation is fired now with correct parameters
      expect(mockMutate).toHaveBeenCalledWith({
        leadId: 'lead-1',
        status: 'won',
        valueUsd: 250,
      });
    });

    it('allows skipping deal value input during Won Deals flow', () => {
      const mockMutate = vi.fn();
      vi.mocked(useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      const mockQueue = [
        {
          id: 'lead-1',
          email: 'customer@example.com',
          name: 'Jane Doe',
          context: 'pricing questions',
          score: 85,
          band: 'HOT',
          status: 'new',
          age_hours: 2,
          urgency: 'high',
          reason: 'Intent detected',
        },
      ];

      vi.mocked(useQuery).mockReturnValue({
        data: { queue: mockQueue, counts: { total: 1, high: 1, medium: 0, low: 0 } },
        isLoading: false,
        isError: false,
      } as any);

      render(
        <ActionCenterPanel
          selectedBotId="bot-123"
          authFetch={mockAuthFetch}
          isAuthorized={true}
          selectedBot={mockSelectedBot}
        />
      );

      // Click Won
      fireEvent.click(screen.getByRole('button', { name: 'Won' }));

      // Click Skip
      const skipButton = screen.getByRole('button', { name: 'Skip' });
      fireEvent.click(skipButton);

      // Mutation is fired with null or fallback
      expect(mockMutate).toHaveBeenCalledWith({
        leadId: 'lead-1',
        status: 'won',
        valueUsd: null,
      });
    });
  });
});
