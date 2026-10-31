import { describe, expect, it } from 'vitest';
import { getPageSupport } from './page-support';

describe('getPageSupport', () => {
  it('reports no access when Chrome hides the URL', () => {
    expect(getPageSupport(undefined)).toEqual({ kind: 'no-access' });
    expect(getPageSupport('')).toEqual({ kind: 'no-access' });
  });

  it('supports regular websites, including localhost', () => {
    expect(getPageSupport('https://www.example.com/work?id=1')).toEqual({
      kind: 'supported',
      hostname: 'www.example.com',
    });
    expect(getPageSupport('http://localhost:5173/')).toEqual({ kind: 'supported', hostname: 'localhost' });
  });

  it.each([
    'chrome://newtab/',
    'chrome://extensions/',
    'chrome-extension://abcdefghijklmnop/sidepanel.html',
    'about:blank',
    'edge://settings',
    'view-source:https://example.com/',
    'devtools://devtools/bundled/inspector.html',
  ])('blocks browser pages: %s', (url) => {
    expect(getPageSupport(url)).toEqual({ kind: 'restricted', reason: 'browser-page' });
  });

  it.each(['https://chromewebstore.google.com/detail/some-extension/abc', 'https://chrome.google.com/webstore/detail/abc'])(
    'blocks the Chrome Web Store: %s',
    (url) => {
      expect(getPageSupport(url)).toEqual({ kind: 'restricted', reason: 'web-store' });
    },
  );

  it('does not treat other chrome.google.com pages as the Web Store', () => {
    expect(getPageSupport('https://chrome.google.com/')).toEqual({ kind: 'supported', hostname: 'chrome.google.com' });
  });

  it('marks local files as not supported yet', () => {
    expect(getPageSupport('file:///C:/Users/me/page.html')).toEqual({ kind: 'restricted', reason: 'local-file' });
  });

  it.each(['data:text/html,<p>hi</p>', 'ftp://example.com/file', 'not a url'])('rejects non-websites: %s', (url) => {
    expect(getPageSupport(url)).toEqual({ kind: 'restricted', reason: 'not-a-website' });
  });
});
