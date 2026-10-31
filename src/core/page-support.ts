/**
 * Decides whether AI Interaction can work on a tab, based on its URL.
 * Pure logic with no browser APIs, so it can be unit-tested.
 */

export type RestrictedReason = 'browser-page' | 'web-store' | 'local-file' | 'not-a-website';

export type PageSupport =
  /** Chrome hides the URL until the user gives the extension access to the tab. */
  | { kind: 'no-access' }
  /** Chrome never lets extensions run here, or we don't support it yet. */
  | { kind: 'restricted'; reason: RestrictedReason }
  | { kind: 'supported'; hostname: string };

const BROWSER_PAGE_PROTOCOLS = new Set([
  'about:',
  'chrome:',
  'chrome-extension:',
  'chrome-search:',
  'chrome-untrusted:',
  'devtools:',
  'edge:',
  'view-source:',
]);

export function getPageSupport(url: string | undefined): PageSupport {
  if (!url) return { kind: 'no-access' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'restricted', reason: 'not-a-website' };
  }

  if (BROWSER_PAGE_PROTOCOLS.has(parsed.protocol)) return { kind: 'restricted', reason: 'browser-page' };
  if (parsed.protocol === 'file:') return { kind: 'restricted', reason: 'local-file' };
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { kind: 'restricted', reason: 'not-a-website' };
  }
  if (isChromeWebStore(parsed)) return { kind: 'restricted', reason: 'web-store' };

  return { kind: 'supported', hostname: parsed.hostname };
}

/** Chrome blocks extensions on its Web Store, at both its new and old addresses. */
function isChromeWebStore(url: URL): boolean {
  return (
    url.hostname === 'chromewebstore.google.com' ||
    (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))
  );
}
