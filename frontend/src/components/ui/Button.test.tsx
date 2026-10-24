import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { Badge } from './Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { BentoGrid, BentoCard } from '../layouts/BentoGrid';

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

  it('renders data-testid and CSS token classes correctly on Button', () => {
    const html = renderToStaticMarkup(<Button variant="primary" data-testid="custom-btn">Click Me</Button>);
    expect(html).toContain('data-testid="custom-btn"');
    expect(html).toContain('var(--color-brand-primary)');
    expect(html).not.toContain('rgb(#');
  });
});

describe('Design System UI Primitives', () => {
  it('renders Badge with tokens and data-testid', () => {
    const html = renderToStaticMarkup(<Badge variant="success" data-testid="status-badge">Active</Badge>);
    expect(html).toContain('data-testid="status-badge"');
    expect(html).toContain('var(--color-success-bg)');
    expect(html).toContain('Active');
  });

  it('renders Card compound components with data-testid attributes', () => {
    const html = renderToStaticMarkup(
      <Card data-testid="test-card">
        <CardHeader data-testid="header">
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(html).toContain('data-testid="test-card"');
    expect(html).toContain('data-testid="header"');
    expect(html).toContain('var(--radius-card)');
  });

  it('renders Input with validation tokens and data-testid', () => {
    const html = renderToStaticMarkup(<Input label="Email" error="Invalid email" data-testid="email-input" />);
    expect(html).toContain('data-testid="email-input"');
    expect(html).toContain('var(--color-border-error)');
    expect(html).toContain('Invalid email');
  });

  it('renders Skeleton placeholder with data-testid', () => {
    const html = renderToStaticMarkup(<Skeleton data-testid="skel" width={100} height={20} />);
    expect(html).toContain('data-testid="skel"');
    expect(html).toContain('aria-busy="true"');
  });

  it('renders BentoGrid and BentoCard layouts with design system tokens', () => {
    const html = renderToStaticMarkup(
      <BentoGrid data-testid="grid">
        <BentoCard glass data-testid="card-1">Card Content</BentoCard>
      </BentoGrid>
    );
    expect(html).toContain('data-testid="grid"');
    expect(html).toContain('data-testid="card-1"');
    expect(html).toContain('var(--color-panel-bg)');
  });
});
