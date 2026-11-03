import { describe, expect, it } from 'vitest';
import { createElementSelection, createPageSelection } from '@/core/selection';
import type { Connection } from './session/useInspectorConnection';
import { getPanelView } from './panel-view';

const exampleTab = { id: 1, url: 'https://example.com/' };
const otherTab = { id: 2, url: 'https://other.dev/' };
const section = createElementSelection({
  scope: 'section',
  tag: 'section',
  id: '',
  classes: ['hero'],
  rect: { left: 0, top: 0, width: 1280, height: 720 },
  scroll: { x: 0, y: 0 },
  path: [{ tag: 'body', id: '', classes: [] }],
  canWiden: true,
  canNarrow: true,
  viewport: { width: 1280, height: 800 },
});
const page = createPageSelection({ page: { width: 1280, height: 4000 }, viewport: { width: 1280, height: 800 }, sections: [] });

function connected(overrides: Partial<Extract<Connection, { status: 'connected' }>> = {}): Connection {
  return { status: 'connected', tabId: 1, hostname: 'example.com', picking: null, selection: null, ...overrides };
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

  it('offers the two workflows on a supported page', () => {
    expect(getPanelView(exampleTab, { status: 'idle' })).toEqual({
      kind: 'home',
      tabId: 1,
      hostname: 'example.com',
      notice: null,
    });
  });

  it('shows the Select Design choices, waiting while it connects', () => {
    expect(getPanelView(exampleTab, { status: 'connecting', tabId: 1, hostname: 'example.com' })).toEqual({
      kind: 'design',
      hostname: 'example.com',
      connecting: true,
    });
    expect(getPanelView(exampleTab, connected())).toEqual({ kind: 'design', hostname: 'example.com', connecting: false });
  });

  it('shows picking, with its mode, while the user chooses on the page', () => {
    expect(getPanelView(exampleTab, connected({ picking: 'section' }))).toEqual({
      kind: 'picking',
      hostname: 'example.com',
      mode: 'section',
    });
  });

  it('shows picking again when choosing again', () => {
    expect(getPanelView(exampleTab, connected({ picking: 'element', selection: section }))).toMatchObject({
      kind: 'picking',
      mode: 'element',
    });
  });

  it('shows the selection: an element or section, or the full page', () => {
    expect(getPanelView(exampleTab, connected({ selection: section }))).toEqual({
      kind: 'selected',
      hostname: 'example.com',
      selection: section,
    });
    expect(getPanelView(exampleTab, connected({ selection: page }))).toMatchObject({ kind: 'selected', selection: page });
  });

  it('asks the user to return when the session belongs to another tab', () => {
    expect(getPanelView(otherTab, connected())).toEqual({ kind: 'away', tabId: 1, hostname: 'example.com' });
  });

  it('shows a closed-session notice only on the tab whose session closed', () => {
    const closed = { status: 'closed', tabId: 1 } as const;
    expect(getPanelView(exampleTab, closed)).toMatchObject({ kind: 'home', notice: { kind: 'connection-closed' } });
    expect(getPanelView(otherTab, closed)).toMatchObject({ kind: 'home', notice: null });
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
      kind: 'home',
      notice: { kind: 'connection-failed', message: 'No access', detail: 'Cannot access contents' },
    });
  });
});
