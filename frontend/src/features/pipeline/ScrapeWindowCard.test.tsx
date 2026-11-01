/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ScrapeWindowCard, windowSentence, type ScrapeWindow } from './ScrapeWindowCard';
import { showToast } from '../../components/ds';
import { SN } from '../../lib/songnodes';

vi.mock('../../lib/apiBase', () => ({ API_BASE_URL: '' }));
vi.mock('../../components/ds', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  showToast: vi.fn<(text: React.ReactNode) => void>(),
}));

const URL = '/api/v1/scrape/window';
const SAVED_AT = '2026-11-01T09:00:00Z';
const win = (starts_on: string | null = null, ends_on: string | null = null, updated_at: string | null = null): ScrapeWindow => ({ starts_on, ends_on, updated_at });
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, detail: unknown) => ({ ok: false, status, json: async () => ({ detail }) });

const group = (name: string) => screen.getByRole('group', { name });
const type = (name: string, d: string, m: string, y: string) => {
  const g = within(group(name));
  fireEvent.change(g.getByLabelText('Day'), { target: { value: d } });
  fireEvent.change(g.getByLabelText('Month'), { target: { value: m } });
  fireEvent.change(g.getByLabelText('Year'), { target: { value: y } });
};
const saveBtn = () => screen.getByRole('button', { name: 'Save window' });
/** The JSON body of the n-th fetch call. */
const sent = (n: number): unknown => { const b = fetchMock.mock.calls[n][1]?.body; return typeof b === 'string' ? JSON.parse(b) : b; };

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>>;
beforeEach(() => {
  fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(showToast).mockClear();
  vi.spyOn(SN.calendar, 'today').mockReturnValue('2026-11-01');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('windowSentence', () => {
  it('reads the window through SN.format.range', () => {
    expect(windowSentence('2026-12-01', '2026-12-31')).toBe('Scheduled scrapes run from Tue 1 – Thu 31 Dec 2026.');
    expect(windowSentence(null, null)).toBe('Scheduled scrapes run every day.');
    expect(windowSentence('2026-12-01', null)).toBe('Scheduled scrapes run from Tue 1 Dec 2026, with no end date.');
    expect(windowSentence(null, '2026-12-31')).toBe('Scheduled scrapes run until Thu 31 Dec 2026.');
  });
});

describe('ScrapeWindowCard', () => {
  it('loads an open window: every day, a default (not primary) Save, no presets', async () => {
    fetchMock.mockResolvedValueOnce(ok(win()));
    render(<ScrapeWindowCard />);
    expect(await screen.findByText('Scheduled scrapes run every day.')).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe(URL);
    expect(screen.getByText('Every day').getAttribute('data-status')).toBe('ok');
    expect(screen.getByText(/Manual scrapes from Queue a scrape are not limited/)).toBeTruthy();
    expect(saveBtn().className).not.toContain('sn-btn--primary');
    expect(saveBtn().hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('group', { name: 'Date presets' })).toBeNull();
  });

  it('loads a future window as paused until its first day, with the dates in the boxes', async () => {
    fetchMock.mockResolvedValueOnce(ok(win('2026-12-01', '2026-12-31', SAVED_AT)));
    render(<ScrapeWindowCard />);
    expect(await screen.findByText(/Scheduled scrapes run from Tue 1 – Thu 31 Dec 2026\. Paused until 1 Dec 2026\./)).toBeTruthy();
    expect(screen.getByText('Paused').getAttribute('data-status')).toBe('idle');
    expect(within(group('From')).getByLabelText('Day')).toHaveProperty('value', '1');
    expect(screen.getByText(new RegExp(`Saved ${SN.format.dateTime(SAVED_AT)}`))).toBeTruthy();
  });

  it('shows running inside the window, and paused after it ended', async () => {
    fetchMock.mockResolvedValueOnce(ok(win('2026-10-20', '2026-11-01')));
    render(<ScrapeWindowCard />);
    expect((await screen.findByText('Running inside window')).getAttribute('data-status')).toBe('running');
    cleanup();
    fetchMock.mockResolvedValueOnce(ok(win('2026-10-01', '2026-10-31')));
    render(<ScrapeWindowCard />);
    expect(await screen.findByText(/Paused: the window ended on 31 Oct 2026\./)).toBeTruthy();
  });

  it('saves typed dates with PUT and confirms with a toast', async () => {
    fetchMock.mockResolvedValueOnce(ok(win()));
    render(<ScrapeWindowCard />);
    await screen.findByText('Scheduled scrapes run every day.');
    type('From', '1', '12', '2026');
    type('To', '31', '12', '2026');
    fetchMock.mockResolvedValueOnce(ok(win('2026-12-01', '2026-12-31', SAVED_AT)));
    fireEvent.click(saveBtn());
    expect(await screen.findByText(/Scheduled scrapes run from Tue 1 – Thu 31 Dec 2026\./)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(URL);
    expect(init.method).toBe('PUT');
    expect(sent(1)).toEqual({ starts_on: '2026-12-01', ends_on: '2026-12-31' });
    expect(showToast).toHaveBeenCalledWith('Scrape window saved');
  });

  it('clears the dates and saves nulls', async () => {
    fetchMock.mockResolvedValueOnce(ok(win('2026-12-01', '2026-12-31', SAVED_AT)));
    render(<ScrapeWindowCard />);
    await screen.findByText('Paused');
    fireEvent.click(screen.getByRole('button', { name: 'Clear dates' }));
    fetchMock.mockResolvedValueOnce(ok(win(null, null, SAVED_AT)));
    fireEvent.click(saveBtn());
    expect(await screen.findByText('Scheduled scrapes run every day.')).toBeTruthy();
    expect(sent(1)).toEqual({ starts_on: null, ends_on: null });
    expect(showToast).toHaveBeenCalledWith('Scrape window cleared');
  });

  it('blocks a From date after the To date before sending', async () => {
    fetchMock.mockResolvedValueOnce(ok(win()));
    render(<ScrapeWindowCard />);
    await screen.findByText('Scheduled scrapes run every day.');
    type('From', '31', '12', '2026');
    type('To', '1', '12', '2026');
    expect(saveBtn().hasAttribute('disabled')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a 422 from the API as the field's error, without a toast", async () => {
    fetchMock.mockResolvedValueOnce(ok(win()));
    render(<ScrapeWindowCard />);
    await screen.findByText('Scheduled scrapes run every day.');
    type('From', '1', '12', '2026');
    fetchMock.mockResolvedValueOnce(fail(422, [{ msg: 'Value error, starts_on must be on or before ends_on.' }]));
    fireEvent.click(saveBtn());
    const error = await screen.findByText('starts_on must be on or before ends_on.');
    expect(error.className).toBe('sn-field__error');
    const field = group('Run scheduled scrapes between');
    expect(field.getAttribute('aria-describedby')).toBe(error.id);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(showToast).not.toHaveBeenCalled();
    type('To', '31', '12', '2026');
    expect(screen.queryByText('starts_on must be on or before ends_on.')).toBeNull();
  });

  it('names the cause when loading fails and can try again', async () => {
    fetchMock.mockResolvedValueOnce(fail(500, 'Database pool not initialized'));
    render(<ScrapeWindowCard />);
    expect(await screen.findByText(/Database pool not initialized/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save window' })).toBeNull();
    fetchMock.mockResolvedValueOnce(ok(win()));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Scheduled scrapes run every day.')).toBeTruthy());
  });

  it('says when the API cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<ScrapeWindowCard />);
    expect(await screen.findByText(/Could not reach the REST API to load the scrape window\./)).toBeTruthy();
  });
});
