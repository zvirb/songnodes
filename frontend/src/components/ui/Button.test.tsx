import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button slot rendering', () => {
  it('keeps the supplied link as the interactive element when adding icons', () => {
    const html = renderToStaticMarkup(
      <Button asChild leftIcon={<span>Icon</span>} shortcut="Enter">
        <a href="/catalog">Catalog</a>
      </Button>
    );
    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/catalog"');
    expect(html).toContain('Catalog');
    expect(html).toContain('Icon');
    expect(html).not.toContain('<button');
  });

  it('announces loading on a slotted link and disables a native button', () => {
    const link = renderToStaticMarkup(<Button asChild loading><a href="/catalog">Catalog</a></Button>);
    expect(link).toContain('aria-disabled="true"');
    expect(link).toContain('aria-busy="true"');
    const button = renderToStaticMarkup(<Button loading>Save</Button>);
    expect(button).toContain('disabled=""');
  });
});
