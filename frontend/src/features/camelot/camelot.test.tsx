/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoveNext } from './MoveNext';

describe('MoveNext', () => {
  it('renders EmptyPanel when no key is selected', () => {
    render(<MoveNext activeKey={null} counts={{}} onMove={vi.fn()} />);
    expect(screen.getByText(/Pick a key on the wheel/i)).toBeDefined();
  });

  it('renders 6 move cards when a key is selected', () => {
    const handleMove = vi.fn();
    render(<MoveNext activeKey="8A" counts={{ '9A': 5 }} onMove={handleMove} />);

    expect(screen.getByText('Where can I move next')).toBeDefined();

    // There should be 6 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);

    // Check for specific labels
    expect(screen.getByText('Up one')).toBeDefined();
    expect(screen.getByText('Relative major')).toBeDefined();

    // Check track count
    expect(screen.getByText('5 tracks')).toBeDefined();
    expect(screen.getAllByText('0 tracks')).toHaveLength(5);

    // Test clicking a card
    fireEvent.click(buttons[1]); // Up one (9A)
    expect(handleMove).toHaveBeenCalledWith('9A');
  });
});
