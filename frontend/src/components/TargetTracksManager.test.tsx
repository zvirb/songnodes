/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import TargetTracksManager from './TargetTracksManager';
import { useTargetSuggestions } from '../hooks/useTargetSuggestions';

vi.mock('../hooks/useTargetSuggestions');

describe('TargetTracksManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders suggested tracks rail if suggestions exist', () => {
    const mockSuggestions = [
      { id: '1', title: 'Suggestion 1', artist: 'Artist 1', reason: 'Because' }
    ];
    vi.mocked(useTargetSuggestions).mockReturnValue({
      suggestions: mockSuggestions,
      loading: false,
      error: null,
      dismissedIds: [],
      refresh: vi.fn(),
      promoteSuggestion: vi.fn(),
      dismissSuggestion: vi.fn()
    });

    render(<TargetTracksManager />);
    expect(screen.getByText('Suggested for Discovery')).toBeDefined();
    expect(screen.getByText('Suggestion 1')).toBeDefined();
    expect(screen.getByText('Artist 1')).toBeDefined();
  });

  it('calls promoteSuggestion when + Add Target is clicked', async () => {
    const promoteSuggestion = vi.fn();
    const mockSuggestions = [
      { id: '1', title: 'Suggestion 1', artist: 'Artist 1', reason: 'Because' }
    ];
    vi.mocked(useTargetSuggestions).mockReturnValue({
      suggestions: mockSuggestions,
      loading: false,
      error: null,
      dismissedIds: [],
      refresh: vi.fn(),
      promoteSuggestion,
      dismissSuggestion: vi.fn()
    });

    render(<TargetTracksManager />);
    const addButtons = screen.getAllByRole('button', { name: /Add Target/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(promoteSuggestion).toHaveBeenCalledWith(mockSuggestions[0]);
    });
  });

  it('calls dismissSuggestion when Dismiss is clicked', async () => {
    const dismissSuggestion = vi.fn();
    const mockSuggestions = [
      { id: '1', title: 'Suggestion 1', artist: 'Artist 1', reason: 'Because' }
    ];
    vi.mocked(useTargetSuggestions).mockReturnValue({
      suggestions: mockSuggestions,
      loading: false,
      error: null,
      dismissedIds: [],
      refresh: vi.fn(),
      promoteSuggestion: vi.fn(),
      dismissSuggestion
    });

    render(<TargetTracksManager />);
    const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(dismissSuggestion).toHaveBeenCalledWith('1');
    });
  });

  it('does not render suggestions rail if no suggestions exist', () => {
    vi.mocked(useTargetSuggestions).mockReturnValue({
      suggestions: [],
      loading: false,
      error: null,
      dismissedIds: [],
      refresh: vi.fn(),
      promoteSuggestion: vi.fn(),
      dismissSuggestion: vi.fn()
    });

    render(<TargetTracksManager />);
    expect(screen.queryByText('Suggested for Discovery')).toBeNull();
  });
});
