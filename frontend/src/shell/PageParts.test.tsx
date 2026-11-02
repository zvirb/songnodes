// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PageHeader } from './PageParts';

afterEach(cleanup);

describe('PageHeader stamp', () => {
  it('shows the verb and an en dash when the time is unknown', () => {
    const { container } = render(<PageHeader lead="Library" title="Melbourne crate" stampVerb="Built" stamp={null} stampUnknown />);
    const stamp = container.querySelector('.sn-page-header__stamp');
    expect(stamp?.textContent?.trim()).toBe('Built –');
    expect(stamp?.querySelector('.sn-none')?.textContent).toBe('–');
    expect(container.querySelector('time')).toBeNull();
  });

  it('shows no stamp when the time is missing and not flagged unknown', () => {
    const { container } = render(<PageHeader lead="Set builder" title="Draft" stampVerb="Saved" stamp={null} />);
    expect(container.querySelector('.sn-page-header__stamp')).toBeNull();
  });
});
