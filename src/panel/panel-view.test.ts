import { describe, expect, it } from 'vitest';
import { getPanelView } from './panel-view';

const exampleTab = { id: 1, url: 'https://example.com/' };
const otherTab = { id: 2, url: 'https://other.dev/' };
const page = { title: 'Example', elementCount: 42 };

describe('getPanelView', () => {
  it('shows loading until the active tab is known', () => {
    expect(getPanelView(null, { status: 'idle' })).toEqual({ kind: 'loading' });
  });

  it('asks for access when Chrome hides the URL', () => {
    expect(getPanelView({ id: 1, url: undefined }, { status: 'idle' })).toEqual({ kind: 'no-access', notice: null });
  });

  it('explains pages Chrome never allows', () => {
    expect(getPanelView({ id: 1, url: 'chrome://newtab/' }, { status: 'idle' })).toEqual({
      kind: 'restricted',
      reason: 'browser-page',
    });
  });

  it('offers to connect on a supported page', () => {
    expect(getPanelView(exampleTab, { status: 'idle' })).toEqual({
      kind: 'ready',
      tabId: 1,
      hostname: 'example.com',
      notice: null,
    });
  });

  it('shows the session on its own tab', () => {
    expect(getPanelView(exampleTab, { status: 'connected', tabId: 1, hostname: 'example.com', page })).toEqual({
      kind: 'connected',
      hostname: 'example.com',
      page,
    });
    expect(getPanelView(exampleTab, { status: 'connecting', tabId: 1, hostname: 'example.com' })).toEqual({
      kind: 'connecting',
      hostname: 'example.com',
    });
  });

  it('asks the user to return when the session belongs to another tab', () => {
    expect(getPanelView(otherTab, { status: 'connected', tabId: 1, hostname: 'example.com', page })).toEqual({
      kind: 'away',
      tabId: 1,
      hostname: 'example.com',
    });
  });

  it('shows a closed-session notice only on the tab whose session closed', () => {
    const closed = { status: 'closed', tabId: 1 } as const;
    expect(getPanelView(exampleTab, closed)).toMatchObject({ kind: 'ready', notice: { kind: 'connection-closed' } });
    expect(getPanelView(otherTab, closed)).toMatchObject({ kind: 'ready', notice: null });
  });

  it('keeps a closed-session notice when the tab moved to a site without access', () => {
    expect(getPanelView({ id: 1, url: undefined }, { status: 'closed', tabId: 1 })).toEqual({
      kind: 'no-access',
      notice: { kind: 'connection-closed' },
    });
  });

  it('shows why connecting failed on that tab', () => {
    const failed = { status: 'failed', tabId: 1, message: 'No access', detail: 'Cannot access contents' } as const;
    expect(getPanelView(exampleTab, failed)).toMatchObject({
      kind: 'ready',
      notice: { kind: 'connection-failed', message: 'No access', detail: 'Cannot access contents' },
    });
  });
});
