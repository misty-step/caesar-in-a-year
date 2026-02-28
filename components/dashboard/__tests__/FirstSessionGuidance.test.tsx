/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FirstSessionGuidance } from '@/components/dashboard/FirstSessionGuidance';

vi.mock('@/components/UI/AudioButton', () => ({
  AudioButton: () => <button type="button">Audio</button>,
}));

const DISMISSED_KEY = 'caesar-first-session-dismissed';

describe('FirstSessionGuidance', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders the guidance card for new users', () => {
    render(<FirstSessionGuidance />);

    expect(screen.getByText(/what to expect today/i)).toBeTruthy();
    expect(screen.getByText(/each/i)).toBeTruthy();
    expect(screen.getByText(/spaced repetition/i)).toBeTruthy();
  });

  it('does not render when previously dismissed', () => {
    localStorage.setItem(DISMISSED_KEY, 'true');

    const { container } = render(<FirstSessionGuidance />);

    expect(container.innerHTML).toBe('');
  });

  it('dismisses when "Got it" button is clicked', () => {
    render(<FirstSessionGuidance />);

    const gotItButton = screen.getByText(/got it/i);
    fireEvent.click(gotItButton);

    expect(localStorage.getItem(DISMISSED_KEY)).toBe('true');
    expect(screen.queryByText(/what to expect today/i)).toBeNull();
  });

  it('dismisses when X button is clicked', () => {
    render(<FirstSessionGuidance />);

    const dismissButton = screen.getByLabelText('Dismiss guidance');
    fireEvent.click(dismissButton);

    expect(localStorage.getItem(DISMISSED_KEY)).toBe('true');
    expect(screen.queryByText(/what to expect today/i)).toBeNull();
  });

  it('persists dismissal across re-renders', () => {
    const { unmount } = render(<FirstSessionGuidance />);

    fireEvent.click(screen.getByText(/got it/i));
    unmount();

    const { container } = render(<FirstSessionGuidance />);
    expect(container.innerHTML).toBe('');
  });
});
