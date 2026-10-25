import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let SwitchComponent: typeof import('./index').Switch;
let TextLinkComponent: typeof import('./index').TextLink;

beforeAll(async () => {
  vi.stubGlobal('window', {});
  ({ Switch: SwitchComponent, TextLink: TextLinkComponent } = await import('./index'));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function renderSwitch(props: { description?: string; disabledReason?: string } = {}) {
  return renderToStaticMarkup(
    createElement(SwitchComponent, {
      label: 'Sprite mode (performance)',
      checked: false,
      onChange: () => {},
      ...props,
    }),
  );
}

function describedIds(markup: string) {
  const value = markup.match(/aria-describedby="([^"]+)"/)?.[1];
  return value ? value.split(' ') : [];
}

describe('Switch', () => {
  it('references only the description that is rendered', () => {
    const markup = renderSwitch({ description: 'Reduces visual effects.' });
    const ids = describedIds(markup);

    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/-d$/);
    expect(markup).toContain(`id="${ids[0]}"`);
  });

  it('references only the disabled reason when no description is present', () => {
    const markup = renderSwitch({ disabledReason: 'Unavailable while syncing.' });
    const ids = describedIds(markup);

    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/-r$/);
    expect(markup).toContain(`id="${ids[0]}"`);
    expect(markup).toContain('aria-disabled="true"');
  });

  it('references both descriptions only when both are rendered', () => {
    const markup = renderSwitch({
      description: 'Reduces visual effects.',
      disabledReason: 'Unavailable while syncing.',
    });
    const ids = describedIds(markup);

    expect(ids).toHaveLength(2);
    ids.forEach((id) => expect(markup).toContain(`id="${id}"`));
  });

  it('omits aria-describedby when there are no descriptions', () => {
    expect(renderSwitch()).not.toContain('aria-describedby=');
  });
});

describe('TextLink', () => {
  it('marks external destinations and the current page accessibly', () => {
    const markup = renderToStaticMarkup(
      createElement(TextLinkComponent, {
        href: 'https://example.com/track',
        external: true,
        module: 'sources',
        current: true,
        children: 'Open source',
      }),
    );

    expect(markup).toContain('class="sn-link sn-m-sources sn-link--ext"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('opens in a new tab');
  });
});
