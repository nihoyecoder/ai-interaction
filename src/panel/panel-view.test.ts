import { describe, expect, it } from 'vitest';
import type { Connection } from './session/useInspectorConnection';
import { getPanelView } from './panel-view';

const exampleTab = { id: 1, url: 'https://example.com/' };
const otherTab = { id: 2, url: 'https://other.dev/' };
const page = { title: 'Example' };
const element = { tag: 'div', id: null, classes: ['card'], width: 320, height: 480 };

function connected(overrides: Partial<Extract<Connection, { status: 'connected' }>> = {}): Connection {
  return { status: 'connected', tabId: 1, hostname: 'example.com', page, picking: false, selected: null, ...overrides };
}

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

  it('shows the connecting state on its own tab', () => {
    expect(getPanelView(exampleTab, { status: 'connecting', tabId: 1, hostname: 'example.com' })).toEqual({
      kind: 'connecting',
      hostname: 'example.com',
    });
  });

  it('shows the connected page on its own tab', () => {
    expect(getPanelView(exampleTab, connected())).toEqual({ kind: 'connected', hostname: 'example.com', page });
  });

  it('shows picking while the user chooses an element', () => {
    expect(getPanelView(exampleTab, connected({ picking: true }))).toEqual({ kind: 'picking', hostname: 'example.com' });
  });

  it('shows the selected element', () => {
    expect(getPanelView(exampleTab, connected({ selected: element }))).toEqual({
      kind: 'selected',
      hostname: 'example.com',
      element,
    });
  });

  it('shows picking again when choosing another element', () => {
    expect(getPanelView(exampleTab, connected({ picking: true, selected: element }))).toEqual({
      kind: 'picking',
      hostname: 'example.com',
    });
  });

  it('asks the user to return when the session belongs to another tab', () => {
    expect(getPanelView(otherTab, connected())).toEqual({ kind: 'away', tabId: 1, hostname: 'example.com' });
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
